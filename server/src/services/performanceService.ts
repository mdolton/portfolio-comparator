import * as transactionService from './transactionService.js';
import * as portfolioService from './portfolioService.js';
import * as marketService from './marketService.js';
import type { PerformancePoint, PerformanceResponse } from '../../../shared/types.js';
import {
  portfolioValueAtDate,
  externalCashFlow,
  timeWeightedReturnSeries,
  type DailyValuePoint,
} from './portfolioMath.js';

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
  // Gather all transactions and portfolio info
  const portfolioData = portfolioIds.map((id) => {
    const portfolio = portfolioService.getPortfolioById(id);
    const transactions = transactionService.getTransactionsByPortfolio(id);
    return { portfolio: portfolio!, transactions };
  });

  // Collect all unique tickers across all portfolios
  const allTickers = new Set<string>();
  for (const { transactions } of portfolioData) {
    for (const tx of transactions) {
      if ((tx.type === 'buy' || tx.type === 'sell') && tx.ticker) {
        allTickers.add(tx.ticker);
      }
    }
  }

  // Fetch historical prices for all tickers
  const pricesByTicker = new Map<string, Map<string, number>>();
  await Promise.all(
    Array.from(allTickers).map(async (ticker) => {
      const prices = await marketService.getHistoricalPrices(ticker, startDate, endDate);
      pricesByTicker.set(ticker, prices);
    }),
  );

  // Generate all dates in range
  const dates = generateDateRange(startDate, endDate);

  // Forward-fill prices: for each ticker, track last known price
  const lastKnownPrice = new Map<string, number>();

  const valueResult: PerformancePoint[] = [];

  // Per-portfolio daily value+flow arrays feed the growth (TWR) series.
  const dailyByPortfolio = new Map<string, DailyValuePoint[]>();
  for (const { portfolio } of portfolioData) {
    if (portfolio) dailyByPortfolio.set(portfolio.name, []);
  }

  for (const date of dates) {
    // Update last known prices for this date (forward-fill)
    for (const ticker of allTickers) {
      const tickerPrices = pricesByTicker.get(ticker);
      if (tickerPrices?.has(date)) {
        lastKnownPrice.set(ticker, tickerPrices.get(date)!);
      }
    }

    const point: PerformancePoint = { date };

    for (const { portfolio, transactions } of portfolioData) {
      if (!portfolio) continue;

      const value = portfolioValueAtDate(transactions, lastKnownPrice, date);
      const flow = transactions.reduce(
        (sum, t) => (t.date === date ? sum + externalCashFlow(t) : sum),
        0,
      );
      dailyByPortfolio.get(portfolio.name)!.push({ date, value, flow });

      // Value series: only plot once the portfolio has any activity by this date.
      if (transactions.some((t) => t.date <= date)) {
        point[portfolio.name] = Math.round(value * 100) / 100;
      }
    }

    const portfolioKeys = Object.keys(point).filter((k) => k !== 'date');
    if (portfolioKeys.length > 0) {
      valueResult.push(point);
    }
  }

  return { value: valueResult, growth: buildGrowthPoints(dailyByPortfolio) };
}
