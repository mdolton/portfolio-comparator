import { Router } from 'express';
import * as portfolioService from '../services/portfolioService.js';
import * as holdingsEnrichment from '../services/holdingsEnrichment.js';
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

  const enriched = await holdingsEnrichment.getEnrichedHoldings(id);

  res.json({
    ...portfolio,
    ...enriched,
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

router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { notes } = req.body;

  const existing = portfolioService.getPortfolioById(id);
  if (!existing) throw new AppError(404, 'Portfolio not found');

  const portfolio = portfolioService.updatePortfolio(id, { notes });
  res.json(portfolio);
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const deleted = portfolioService.deletePortfolio(id);
  if (!deleted) throw new AppError(404, 'Portfolio not found');
  res.status(204).send();
});

export default router;
