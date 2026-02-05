import { Router } from 'express';
import * as marketService from '../services/marketService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/search', async (req, res) => {
  const q = req.query.q as string;
  if (!q || q.trim().length === 0) {
    throw new AppError(400, 'Search query is required');
  }
  try {
    const results = await marketService.searchTickers(q.trim());
    res.json(results);
  } catch (err) {
    console.log('[market/search] Error:', err);
    res.json([]);
  }
});

router.get('/quote/:symbol', async (req, res) => {
  const { symbol } = req.params;
  try {
    const quote = await marketService.getQuote(symbol.toUpperCase());
    res.json(quote);
  } catch (err) {
    console.log('[market/quote] Error:', err);
    throw new AppError(502, 'Failed to fetch quote');
  }
});

export default router;
