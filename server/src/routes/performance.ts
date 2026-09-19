import { Router } from 'express';
import * as performanceService from '../services/performanceService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const DATE_RE = /^(\d{4})-(0[1-9]|1[012])-(0[1-9]|[12]\d|3[01])$/;
const MAX_RANGE_DAYS = 3653; // ~10 years

function validateDateRange(start: string, end: string): void {
  if (!DATE_RE.test(start)) throw new AppError(400, 'Start date must be in YYYY-MM-DD format');
  if (!DATE_RE.test(end)) throw new AppError(400, 'End date must be in YYYY-MM-DD format');

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (startDate > endDate) throw new AppError(400, 'Start date must not be after end date');

  const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > MAX_RANGE_DAYS) throw new AppError(400, 'Date range must not exceed 10 years');
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
