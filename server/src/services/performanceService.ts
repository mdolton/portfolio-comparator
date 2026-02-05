import * as transactionService from './transactionService.js';
import * as portfolioService from './portfolioService.js';
import * as marketService from './marketService.js';
import type { PerformancePoint, Transaction } from '../../../shared/types.js';

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

export async function getPerformanceData(
  portfolioIds: number[],
  startDate: string,
  endDate: string,
): Promise<PerformancePoint[]> {
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
      allTickers.add(tx.ticker);
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

  const result: PerformancePoint[] = [];

  for (const date of dates) {
    // Update last known prices for this date
    for (const ticker of allTickers) {
      const tickerPrices = pricesByTicker.get(ticker);
      if (tickerPrices?.has(date)) {
        lastKnownPrice.set(ticker, tickerPrices.get(date)!);
      }
    }

    const point: PerformancePoint = { date };

    for (const { portfolio, transactions } of portfolioData) {
      if (!portfolio) continue;

      // Calculate holdings at this date
      const holdings = calculateHoldingsAtDate(transactions, date);

      // Calculate portfolio value
      let totalValue = 0;
      let hasPrice = false;

      for (const [ticker, shares] of holdings) {
        const price = lastKnownPrice.get(ticker);
        if (price !== undefined) {
          totalValue += shares * price;
          hasPrice = true;
        }
      }

      // Only include the point if we have price data and holdings
      if (hasPrice || holdings.size === 0) {
        point[portfolio.name] = Math.round(totalValue * 100) / 100;
      }
    }

    // Only add the point if at least one portfolio has data
    const portfolioKeys = Object.keys(point).filter((k) => k !== 'date');
    if (portfolioKeys.length > 0) {
      result.push(point);
    }
  }

  return result;
}

function calculateHoldingsAtDate(
  transactions: Transaction[],
  date: string,
): Map<string, number> {
  const holdings = new Map<string, number>();

  // Filter and sort transactions up to this date
  const relevant = transactions
    .filter((tx) => tx.date <= date)
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      // Buys before sells on same day
      if (a.type === 'buy' && b.type === 'sell') return -1;
      if (a.type === 'sell' && b.type === 'buy') return 1;
      return 0;
    });

  for (const tx of relevant) {
    const current = holdings.get(tx.ticker) ?? 0;
    if (tx.type === 'buy') {
      holdings.set(tx.ticker, current + tx.shares);
    } else {
      holdings.set(tx.ticker, current - tx.shares);
    }
  }

  // Remove zero holdings
  for (const [ticker, shares] of holdings) {
    if (shares < 1e-9) holdings.delete(ticker);
  }

  return holdings;
}
