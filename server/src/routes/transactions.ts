import { Router } from 'express';
import * as transactionService from '../services/transactionService.js';
import * as portfolioService from '../services/portfolioService.js';
import { AppError } from '../middleware/errorHandler.js';
import { isValidISODate, latestLocalToday } from '../utils/dates.js';

const router = Router();

// Yahoo Finance symbols: class shares (BRK-B), indices (^GSPC), FX/futures (EURUSD=X).
const TICKER_RE = /^[A-Z0-9.\-^=]{1,15}$/;

function validateDate(date: unknown): asserts date is string {
  if (!isValidISODate(date)) throw new AppError(400, 'Date must be a valid YYYY-MM-DD date');
  // Compare calendar days, not instants: the client sends its local date, which
  // can be a day ahead of the server's UTC date.
  if (date > latestLocalToday()) throw new AppError(400, 'Date cannot be in the future');
}

const TYPES = ['buy', 'sell', 'deposit', 'withdrawal', 'dividend'] as const;

// GET /api/portfolios/:id/transactions
router.get('/portfolios/:id/transactions', (req, res) => {
  const portfolioId = parseInt(req.params.id);
  const portfolio = portfolioService.getPortfolioById(portfolioId);
  if (!portfolio) throw new AppError(404, 'Portfolio not found');

  const transactions = transactionService.getTransactionsByPortfolio(portfolioId);
  res.json(transactions);
});

// POST /api/portfolios/:id/transactions
router.post('/portfolios/:id/transactions', (req, res) => {
  const portfolioId = parseInt(req.params.id);
  const portfolio = portfolioService.getPortfolioById(portfolioId);
  if (!portfolio) throw new AppError(404, 'Portfolio not found');

  const { type, ticker: rawTicker, shares, price, amount, date } = req.body;

  if (!TYPES.includes(type)) throw new AppError(400, 'Invalid transaction type');
  validateDate(date);

  const isTrade = type === 'buy' || type === 'sell';
  if (isTrade) {
    if (!rawTicker || typeof rawTicker !== 'string') throw new AppError(400, 'Valid ticker is required');
    if (typeof shares !== 'number' || shares <= 0) throw new AppError(400, 'Shares must be a positive number');
    if (typeof price !== 'number' || price <= 0) throw new AppError(400, 'Price must be a positive number');
  } else {
    if (typeof amount !== 'number' || amount <= 0) throw new AppError(400, 'Amount must be a positive number');
    if (type === 'dividend' && rawTicker != null && typeof rawTicker !== 'string') {
      throw new AppError(400, 'Ticker must be a string');
    }
  }

  // Ticker only applies to trades and (optionally) dividends; ignore it otherwise.
  const usesTicker = isTrade || type === 'dividend';
  const ticker = usesTicker && rawTicker ? transactionService.normalizeTicker(rawTicker) : null;
  if (usesTicker && rawTicker && (!ticker || !TICKER_RE.test(ticker))) {
    throw new AppError(400, 'Ticker format is invalid');
  }

  const transaction = transactionService.addTransaction(portfolioId, {
    type,
    date,
    ticker,
    shares: isTrade ? shares : null,
    price: isTrade ? price : null,
    amount: isTrade ? null : amount,
  });
  res.status(201).json(transaction);
});

// DELETE /api/transactions/:id
router.delete('/transactions/:id', (req, res) => {
  const transactionId = parseInt(req.params.id);
  const deleted = transactionService.deleteTransaction(transactionId);
  if (!deleted) throw new AppError(404, 'Transaction not found');
  res.status(204).send();
});

export default router;
