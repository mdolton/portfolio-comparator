import { Router } from 'express';
import * as portfolioService from '../services/portfolioService.js';
import * as transactionService from '../services/transactionService.js';
import * as marketService from '../services/marketService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', (_req, res) => {
  const portfolios = portfolioService.getAllPortfolios();
  res.json(portfolios);
});

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const portfolio = portfolioService.getPortfolioById(id);
  if (!portfolio) throw new AppError(404, 'Portfolio not found');

  const holdings = transactionService.getHoldings(id);

  // Enrich holdings with current prices
  let totalValue: number | null = 0;
  for (const holding of holdings) {
    try {
      const quote = await marketService.getQuote(holding.ticker);
      holding.currentPrice = quote.price;
      holding.marketValue = holding.shares * quote.price;
      holding.gainLoss = holding.marketValue - holding.totalCost;
      holding.gainLossPercent = holding.totalCost > 0 ? (holding.gainLoss / holding.totalCost) * 100 : null;
      if (totalValue !== null) totalValue += holding.marketValue;
    } catch {
      totalValue = null;
    }
  }

  res.json({
    ...portfolio,
    holdings,
    totalValue,
    totalCost: holdings.reduce((sum, h) => sum + h.totalCost, 0),
  });
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new AppError(400, 'Portfolio name is required');
  }
  try {
    const portfolio = portfolioService.createPortfolio(name.trim());
    res.status(201).json(portfolio);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
      throw new AppError(409, 'A portfolio with this name already exists');
    }
    throw err;
  }
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const deleted = portfolioService.deletePortfolio(id);
  if (!deleted) throw new AppError(404, 'Portfolio not found');
  res.status(204).send();
});

export default router;
