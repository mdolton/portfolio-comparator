import { Router } from 'express';
import * as performanceService from '../services/performanceService.js';
import { AppError } from '../middleware/errorHandler.js';
import { isValidISODate, daysBetween } from '../utils/dates.js';

const router = Router();

const MAX_RANGE_DAYS = 3653; // ~10 years

function validateDateRange(start: unknown, end: unknown): void {
  if (!isValidISODate(start)) throw new AppError(400, 'Start date must be a valid YYYY-MM-DD date');
  if (!isValidISODate(end)) throw new AppError(400, 'End date must be a valid YYYY-MM-DD date');
  if (start > end) throw new AppError(400, 'Start date must not be after end date');
  if (daysBetween(start, end) > MAX_RANGE_DAYS) throw new AppError(400, 'Date range must not exceed 10 years');
}

router.get('/', async (req, res) => {
  const idsParam = req.query.ids as string;
  const start = req.query.start as string;
  const end = req.query.end as string;

  if (!idsParam) throw new AppError(400, 'Portfolio IDs are required (ids=1,2,...)');
  if (!start || !end) throw new AppError(400, 'Start and end dates are required');

  validateDateRange(start, end);

  const ids = idsParam.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
  if (ids.length === 0) throw new AppError(400, 'At least one valid portfolio ID is required');

  const data = await performanceService.getPerformanceData(ids, start, end);
  res.json(data);
});

export default router;
