import { Router } from 'express';
import * as transactionService from '../services/transactionService.js';
import * as portfolioService from '../services/portfolioService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const DATE_RE = /^(\d{4})-(0[1-9]|1[012])-(0[1-9]|[12]\d|3[01])$/;
const TICKER_RE = /^[A-Z0-9.]{1,10}$/;

function validateDate(dateStr: string): void {
  if (!DATE_RE.test(dateStr)) throw new AppError(400, 'Date must be in YYYY-MM-DD format');
  const date = new Date(dateStr);
  if (date > new Date()) throw new AppError(400, 'Date cannot be in the future');
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

  const { type, ticker: rawTicker, shares, price, amount, date: rawDate } = req.body;

  if (!TYPES.includes(type)) throw new AppError(400, 'Invalid transaction type');
  const date = rawDate as string;
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

  const ticker = rawTicker ? rawTicker.trim().toUpperCase() : null;
  if (ticker && !TICKER_RE.test(ticker)) throw new AppError(400, 'Ticker format is invalid');

  const transaction = transactionService.addTransaction(portfolioId, {
    type,
    date,
    ticker: isTrade || (type === 'dividend' && ticker) ? ticker : null,
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
