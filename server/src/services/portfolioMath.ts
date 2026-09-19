import type { Transaction, Holding } from '../../../shared/types.js';

/** One day of a portfolio's history: total value and the external cash flow
 *  (deposits − withdrawals) that occurred that day. */
export interface DailyValuePoint {
  date: string;
  value: number;
  flow: number;
}

/** Cumulative time-weighted return at a date, in percent. */
export interface GrowthPoint {
  date: string;
  growthPct: number;
}

/** Cash impact of a single transaction. */
export function cashDelta(
  tx: Pick<Transaction, 'type' | 'shares' | 'price' | 'amount'>,
): number {
  switch (tx.type) {
    case 'buy':
      return -((tx.shares ?? 0) * (tx.price ?? 0));
    case 'sell':
      return (tx.shares ?? 0) * (tx.price ?? 0);
    case 'deposit':
    case 'dividend':
      return tx.amount ?? 0;
    case 'withdrawal':
      return -(tx.amount ?? 0);
    default:
      return 0;
  }
}

/** External cash flow of a single transaction: deposits/withdrawals only.
 *  Dividends count as investment return (not external), and buys/sells are
 *  internal cash<->shares swaps, so all three return 0. */
export function externalCashFlow(
  tx: Pick<Transaction, 'type' | 'amount'>,
): number {
  switch (tx.type) {
    case 'deposit':
      return tx.amount ?? 0;
    case 'withdrawal':
      return -(tx.amount ?? 0);
    default:
      return 0;
  }
}

/** Cash balance from summing deltas, optionally only through `asOf` (inclusive). */
export function computeCashBalance(
  txs: Array<Pick<Transaction, 'type' | 'shares' | 'price' | 'amount' | 'date'>>,
  asOf?: string,
): number {
  return txs.reduce(
    (sum, tx) => (asOf && tx.date > asOf ? sum : sum + cashDelta(tx)),
    0,
  );
}

/** Derive current securities positions from buy/sell transactions only. */
export function computeHoldings(txs: Transaction[]): Holding[] {
  const map = new Map<string, { shares: number; totalCost: number }>();

  for (const tx of txs) {
    if (tx.type !== 'buy' && tx.type !== 'sell') continue;
    if (!tx.ticker || tx.shares == null || tx.price == null) continue;

    const current = map.get(tx.ticker) ?? { shares: 0, totalCost: 0 };
    if (tx.type === 'buy') {
      current.totalCost += tx.shares * tx.price;
      current.shares += tx.shares;
    } else {
      if (current.shares > 0) {
        const costPerShare = current.totalCost / current.shares;
        current.totalCost -= tx.shares * costPerShare;
      }
      current.shares -= tx.shares;
    }
    map.set(tx.ticker, current);
  }

  const holdings: Holding[] = [];
  for (const [ticker, data] of map) {
    if (data.shares < 1e-9) continue;
    holdings.push({
      ticker,
      shares: data.shares,
      avgCost: data.totalCost / data.shares,
      totalCost: data.totalCost,
      currentPrice: null,
      marketValue: null,
      gainLoss: null,
      gainLossPercent: null,
    });
  }
  return holdings;
}

/** A portfolio's state at the end of one day, from `PortfolioAccumulator.advanceTo`. */
export interface DailySnapshot {
  /** Priced securities + cash balance. Unrounded, so it is safe to chain into TWR. */
  value: number;
  /** External cash flow (deposits − withdrawals) dated exactly this day. */
  flow: number;
  /** True once any transaction is dated on/before this day. */
  hasActivity: boolean;
}

/** Walks a portfolio's transactions once while a caller steps through
 *  ascending dates, so a d-day series costs O(n + d) rather than O(n·d).
 *  Transactions are sorted here; callers need not pre-sort them. */
export class PortfolioAccumulator {
  private readonly sorted: Transaction[];
  private readonly holdings = new Map<string, number>();
  private cash = 0;
  private cursor = 0;
  private lastDate = '';

  constructor(txs: Transaction[]) {
    this.sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Apply every transaction dated on/before `date` and value the portfolio
   *  with `pricesAtDate`; securities with no known price are skipped.
   *  Dates must be passed in ascending order. */
  advanceTo(date: string, pricesAtDate: Map<string, number>): DailySnapshot {
    if (date < this.lastDate) {
      throw new Error(`PortfolioAccumulator dates must ascend: ${date} after ${this.lastDate}`);
    }
    this.lastDate = date;

    let flow = 0;
    while (this.cursor < this.sorted.length && this.sorted[this.cursor].date <= date) {
      const tx = this.sorted[this.cursor++];
      if ((tx.type === 'buy' || tx.type === 'sell') && tx.ticker && tx.shares != null) {
        const current = this.holdings.get(tx.ticker) ?? 0;
        this.holdings.set(tx.ticker, tx.type === 'buy' ? current + tx.shares : current - tx.shares);
      }
      this.cash += cashDelta(tx);
      if (tx.date === date) flow += externalCashFlow(tx);
    }

    let value = this.cash;
    for (const [ticker, shares] of this.holdings) {
      if (shares < 1e-9) continue;
      const price = pricesAtDate.get(ticker);
      if (price !== undefined) value += shares * price;
    }

    return { value, flow, hasActivity: this.cursor > 0 };
  }
}

/** Cumulative time-weighted return (%) per date. Chains daily growth factors,
 *  dividing out external cash flows so deposits/withdrawals never count as
 *  growth. The baseline (0%) is the first day with positive value; earlier
 *  days are omitted. Days whose prior value is <= 0 are treated as flat to
 *  avoid divide-by-zero (e.g. account emptied then re-funded). */
export function timeWeightedReturnSeries(points: DailyValuePoint[]): GrowthPoint[] {
  const result: GrowthPoint[] = [];
  let index = 1; // cumulative TWR index; growth% = (index - 1) * 100 (negative for a loss)
  let prevValue = 0; // value at the previous day, V(d-1)
  let started = false;

  for (const { date, value, flow } of points) {
    if (!started) {
      // Establish the baseline on the first day the portfolio holds value.
      if (value > 0) {
        started = true;
        prevValue = value;
        result.push({ date, growthPct: 0 });
      }
      continue;
    }

    // V(d-1) > 0: chain the day's growth factor, removing the external flow.
    //   A market decline alone keeps V(d-1) > 0, so a genuine loss flows through here.
    // V(d-1) <= 0: no invested base (account fully drained/overdrawn by a prior
    //   withdrawal), so treat the day as flat (factor = 1) to avoid divide-by-zero.
    if (prevValue > 0) {
      index *= (value - flow) / prevValue;
    }

    result.push({ date, growthPct: (index - 1) * 100 });
    prevValue = value;
  }

  return result;
}

/** First sell that would drive a ticker's share balance negative, or null. */
export function negativeShareViolation(
  trades: Array<Pick<Transaction, 'type' | 'ticker' | 'shares' | 'date'>>,
): { ticker: string; date: string; balance: number } | null {
  const EPSILON = 1e-9;
  const balanceByTicker = new Map<string, number>();

  const sorted = trades
    .filter((t) => t.type === 'buy' || t.type === 'sell')
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      if (a.type === 'buy' && b.type === 'sell') return -1;
      if (a.type === 'sell' && b.type === 'buy') return 1;
      return 0;
    });

  for (const tx of sorted) {
    if (!tx.ticker || tx.shares == null) continue;
    const current = balanceByTicker.get(tx.ticker) ?? 0;
    const newBalance = tx.type === 'buy' ? current + tx.shares : current - tx.shares;
    if (newBalance < -EPSILON) {
      return { ticker: tx.ticker, date: tx.date, balance: newBalance };
    }
    balanceByTicker.set(tx.ticker, newBalance);
  }
  return null;
}
