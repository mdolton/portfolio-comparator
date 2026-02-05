import db from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Transaction, Holding } from '../../../shared/types.js';

export function getTransactionsByPortfolio(portfolioId: number): Transaction[] {
  return db
    .prepare('SELECT * FROM transactions WHERE portfolio_id = ? ORDER BY date ASC, type ASC')
    .all(portfolioId) as Transaction[];
}

function validateShareBalance(
  transactions: Array<{ type: string; shares: number; date: string; ticker: string }>,
): void {
  const balanceByTicker = new Map<string, number>();
  const EPSILON = 1e-9;

  // Sort: by date, then buys before sells on same date
  const sorted = [...transactions].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    if (a.type === 'buy' && b.type === 'sell') return -1;
    if (a.type === 'sell' && b.type === 'buy') return 1;
    return 0;
  });

  for (const tx of sorted) {
    const current = balanceByTicker.get(tx.ticker) ?? 0;
    const newBalance = tx.type === 'buy' ? current + tx.shares : current - tx.shares;
    if (newBalance < -EPSILON) {
      throw new AppError(
        400,
        `Cannot complete: would result in negative shares for ${tx.ticker} on ${tx.date} (balance would be ${newBalance.toFixed(4)})`,
      );
    }
    balanceByTicker.set(tx.ticker, newBalance);
  }
}

export function addTransaction(
  portfolioId: number,
  ticker: string,
  type: 'buy' | 'sell',
  shares: number,
  price: number,
  date: string,
): Transaction {
  const existing = getTransactionsByPortfolio(portfolioId);
  const proposed = [...existing, { ticker, type, shares, date }];
  validateShareBalance(proposed);

  const stmt = db.prepare(
    'INSERT INTO transactions (portfolio_id, ticker, type, shares, price, date) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const result = stmt.run(portfolioId, ticker.toUpperCase(), type, shares, price, date);
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid) as Transaction;
}

export function deleteTransaction(transactionId: number): boolean {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId) as
    | Transaction
    | undefined;
  if (!tx) return false;

  // Validate that removing this transaction won't cause negative balances
  const allTx = getTransactionsByPortfolio(tx.portfolio_id);
  const remaining = allTx.filter((t) => t.id !== transactionId);
  validateShareBalance(remaining);

  const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(transactionId);
  return result.changes > 0;
}

export function getHoldings(portfolioId: number): Holding[] {
  const transactions = getTransactionsByPortfolio(portfolioId);
  const holdingsMap = new Map<string, { shares: number; totalCost: number }>();

  for (const tx of transactions) {
    const current = holdingsMap.get(tx.ticker) ?? { shares: 0, totalCost: 0 };
    if (tx.type === 'buy') {
      current.totalCost += tx.shares * tx.price;
      current.shares += tx.shares;
    } else {
      // Reduce cost proportionally
      if (current.shares > 0) {
        const costPerShare = current.totalCost / current.shares;
        current.totalCost -= tx.shares * costPerShare;
      }
      current.shares -= tx.shares;
    }
    holdingsMap.set(tx.ticker, current);
  }

  const holdings: Holding[] = [];
  for (const [ticker, data] of holdingsMap) {
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
