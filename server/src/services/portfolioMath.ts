import type { Transaction, Holding } from '../../../shared/types.js';

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
