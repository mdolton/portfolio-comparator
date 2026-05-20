import { Router } from 'express';
import * as transactionService from '../services/transactionService.js';
import * as portfolioService from '../services/portfolioService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

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

  const { type, ticker, shares, price, amount, date } = req.body;

  const TYPES = ['buy', 'sell', 'deposit', 'withdrawal', 'dividend'];
  if (!TYPES.includes(type)) throw new AppError(400, 'Invalid transaction type');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, 'Date must be in YYYY-MM-DD format');
  }

  const isTrade = type === 'buy' || type === 'sell';
  if (isTrade) {
    if (!ticker || typeof ticker !== 'string') throw new AppError(400, 'Valid ticker is required');
    if (typeof shares !== 'number' || shares <= 0) throw new AppError(400, 'Shares must be a positive number');
    if (typeof price !== 'number' || price <= 0) throw new AppError(400, 'Price must be a positive number');
  } else {
    if (typeof amount !== 'number' || amount <= 0) throw new AppError(400, 'Amount must be a positive number');
    if (type === 'dividend' && ticker != null && typeof ticker !== 'string') {
      throw new AppError(400, 'Ticker must be a string');
    }
  }

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
