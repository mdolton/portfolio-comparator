import db from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Transaction, Holding, TransactionType } from '../../../shared/types.js';
import { computeHoldings, computeCashBalance, negativeShareViolation } from './portfolioMath.js';

export function getTransactionsByPortfolio(portfolioId: number): Transaction[] {
  return db
    .prepare('SELECT * FROM transactions WHERE portfolio_id = ? ORDER BY date ASC, type ASC')
    .all(portfolioId) as Transaction[];
}

export interface NewTransactionInput {
  type: TransactionType;
  ticker?: string | null;
  shares?: number | null;
  price?: number | null;
  amount?: number | null;
  date: string;
}

export function addTransaction(portfolioId: number, input: NewTransactionInput): Transaction {
  const isTrade = input.type === 'buy' || input.type === 'sell';

  if (isTrade) {
    const existing = getTransactionsByPortfolio(portfolioId);
    const proposed = [
      ...existing,
      { type: input.type, ticker: input.ticker ?? null, shares: input.shares ?? null, date: input.date },
    ];
    const violation = negativeShareViolation(proposed);
    if (violation) {
      throw new AppError(
        400,
        `Cannot complete: would result in negative shares for ${violation.ticker} on ${violation.date} (balance would be ${violation.balance.toFixed(4)})`,
      );
    }
  }

  const ticker = input.ticker ? input.ticker.toUpperCase() : null;
  const result = db
    .prepare(
      'INSERT INTO transactions (portfolio_id, type, ticker, shares, price, amount, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      portfolioId,
      input.type,
      ticker,
      input.shares ?? null,
      input.price ?? null,
      input.amount ?? null,
      input.date,
    );

  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid) as Transaction;
}

export function deleteTransaction(transactionId: number): boolean {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId) as
    | Transaction
    | undefined;
  if (!tx) return false;

  const remaining = getTransactionsByPortfolio(tx.portfolio_id).filter((t) => t.id !== transactionId);
  const violation = negativeShareViolation(remaining);
  if (violation) {
    throw new AppError(
      400,
      `Cannot delete: would result in negative shares for ${violation.ticker} on ${violation.date} (balance would be ${violation.balance.toFixed(4)})`,
    );
  }

  const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(transactionId);
  return result.changes > 0;
}

export function getHoldings(portfolioId: number): Holding[] {
  return computeHoldings(getTransactionsByPortfolio(portfolioId));
}

export function getCashBalance(portfolioId: number): number {
  return computeCashBalance(getTransactionsByPortfolio(portfolioId));
}
