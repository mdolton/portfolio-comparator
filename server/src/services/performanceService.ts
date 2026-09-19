import * as transactionService from './transactionService.js';
import * as portfolioService from './portfolioService.js';
import * as marketService from './marketService.js';
import { cashDelta, externalCashFlow, timeWeightedReturnSeries, type DailyValuePoint } from './portfolioMath.js';
import type { PerformancePoint, PerformanceResponse } from '../../../shared/types.js';

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/** Merge per-portfolio TWR series into date-keyed PerformancePoints. */
function buildGrowthPoints(
  dailyByPortfolio: Map<string, DailyValuePoint[]>,
): PerformancePoint[] {
  const byDate = new Map<string, PerformancePoint>();

  for (const [name, daily] of dailyByPortfolio) {
    for (const { date, growthPct } of timeWeightedReturnSeries(daily)) {
      const point = byDate.get(date) ?? { date };
      point[name] = Math.round(growthPct * 100) / 100;
      byDate.set(date, point);
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getPerformanceData(
  portfolioIds: number[],
  startDate: string,
  endDate: string,
): Promise<PerformanceResponse> {
  const portfolioData = portfolioIds.map((id) => {
    const portfolio = portfolioService.getPortfolioById(id);
    const transactions = transactionService.getTransactionsByPortfolio(id);
    return { portfolio: portfolio!, transactions };
  });

  const allTickers = new Set<string>();
  for (const { transactions } of portfolioData) {
    for (const tx of transactions) {
      if ((tx.type === 'buy' || tx.type === 'sell') && tx.ticker) {
        allTickers.add(tx.ticker);
      }
    }
  }

  const pricesByTicker = new Map<string, Map<string, number>>();
  await Promise.all(
    Array.from(allTickers).map(async (ticker) => {
      const prices = await marketService.getHistoricalPrices(ticker, startDate, endDate);
      pricesByTicker.set(ticker, prices);
    }),
  );

  const dates = generateDateRange(startDate, endDate);

  // Forward-fill prices: for each ticker, track last known price
  const lastKnownPrice = new Map<string, number>();

  const valueResult: PerformancePoint[] = [];

  // Per-portfolio daily value+flow arrays feed the growth (TWR) series.
  const dailyByPortfolio = new Map<string, DailyValuePoint[]>();

  // Incremental computation state — avoids re-filtering/re-sorting all
  // transactions from scratch every day (O(n·d) → O(n)).
  const runningHoldings = new Map<string, Map<string, number>>();
  const runningCash = new Map<string, number>();
  const txCursor = new Map<string, number>();

  for (const { portfolio } of portfolioData) {
    if (portfolio) {
      dailyByPortfolio.set(portfolio.name, []);
      runningHoldings.set(portfolio.name, new Map());
      runningCash.set(portfolio.name, 0);
      txCursor.set(portfolio.name, 0);
    }
  }

  for (const date of dates) {
    for (const ticker of allTickers) {
      const tickerPrices = pricesByTicker.get(ticker);
      if (tickerPrices?.has(date)) {
        lastKnownPrice.set(ticker, tickerPrices.get(date)!);
      }
    }

    const point: PerformancePoint = { date };

    for (const { portfolio, transactions } of portfolioData) {
      if (!portfolio) continue;

      const holdings = runningHoldings.get(portfolio.name)!;
      let cash = runningCash.get(portfolio.name)!;
      let flow = 0;
      let cursor = txCursor.get(portfolio.name)!;

      // Advance through transactions in date order, updating running state once.
      while (cursor < transactions.length && transactions[cursor].date <= date) {
        const tx = transactions[cursor];

        if ((tx.type === 'buy' || tx.type === 'sell') && tx.ticker && tx.shares != null) {
          const current = holdings.get(tx.ticker) ?? 0;
          holdings.set(tx.ticker, tx.type === 'buy' ? current + tx.shares : current - tx.shares);
        }

        cash += cashDelta(tx);

        if (tx.date === date) {
          flow += externalCashFlow(tx);
        }

        cursor++;
      }
      txCursor.set(portfolio.name, cursor);
      runningCash.set(portfolio.name, cash);

      // Value = priced securities + cash balance
      let value = cash;
      for (const [ticker, shares] of holdings) {
        if (shares < 1e-9) continue;
        const price = lastKnownPrice.get(ticker);
        if (price !== undefined) value += shares * price;
      }

      const rounded = Math.round(value * 100) / 100;
      dailyByPortfolio.get(portfolio.name)!.push({ date, value: rounded, flow });

      if (cursor > 0) {
        point[portfolio.name] = rounded;
      }
    }

    const portfolioKeys = Object.keys(point).filter((k) => k !== 'date');
    if (portfolioKeys.length > 0) {
      valueResult.push(point);
    }
  }

  return { value: valueResult, growth: buildGrowthPoints(dailyByPortfolio) };
}
