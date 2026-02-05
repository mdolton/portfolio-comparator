import { Router } from 'express';
import * as performanceService from '../services/performanceService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', async (req, res) => {
  const idsParam = req.query.ids as string;
  const start = req.query.start as string;
  const end = req.query.end as string;

  if (!idsParam) throw new AppError(400, 'Portfolio IDs are required (ids=1,2,...)');
  if (!start || !end) throw new AppError(400, 'Start and end dates are required');

  const ids = idsParam.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
  if (ids.length === 0) throw new AppError(400, 'At least one valid portfolio ID is required');

  const data = await performanceService.getPerformanceData(ids, start, end);
  res.json(data);
});

export default router;
