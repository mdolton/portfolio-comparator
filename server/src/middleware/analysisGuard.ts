import type { Request, Response, NextFunction } from 'express';
import * as portfolioService from '../services/portfolioService.js';

/**
 * Tracks in-flight analysis generation per portfolio.
 */
const activeAnalyses = new Set<number>();

/** Maximum concurrent analysis requests across all portfolios. */
const GLOBAL_CONCURRENCY_LIMIT = 3;

/**
 * Stash key used to pass the parsed portfolio id from guard to handler.
 */
const LOCALS_KEY = 'analysisPortfolioId';

/**
 * Express middleware that rejects requests if an analysis is already
 * being generated for the given portfolio, or if the global concurrency
 * limit has been reached. Parses the id *once* and stashes it on
 * `res.locals` so the route handler uses the identical value.
 *
 * The portfolio-exists check runs before the lock is acquired to
 * prevent entries for nonexistent ids.
 */
export function analysisGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Validate and parse the portfolio id up front
  const raw = req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id) || String(id) !== raw) {
    res.status(400).json({ error: 'Invalid portfolio id' });
    return;
  }

  // Verify the portfolio exists before taking a lock slot
  const portfolio = portfolioService.getPortfolioById(id);
  if (!portfolio) {
    res.status(404).json({ error: 'Portfolio not found' });
    return;
  }

  // Check global concurrency limit
  if (activeAnalyses.size >= GLOBAL_CONCURRENCY_LIMIT) {
    res.status(429).json({ error: 'Too many concurrent analysis requests. Try again later.' });
    return;
  }

  // Per-portfolio dedup
  if (activeAnalyses.has(id)) {
    res.status(409).json({ error: 'Analysis already in progress for this portfolio' });
    return;
  }

  activeAnalyses.add(id);
  res.locals[LOCALS_KEY] = id;
  next();
}

/**
 * Run a handler with the analysis lock held.
 *
 * Acquires the lock before calling `fn`, then releases it in `finally`
 * so the lock can never leak. The id is taken from `res.locals` where
 * `analysisGuard` stashed it, guaranteeing the same integer value is
 * used for acquire and release.
 */
export async function withAnalysisLock<T>(
  res: Response,
  fn: () => Promise<T>,
): Promise<T> {
  const id = res.locals[LOCALS_KEY] as number;
  try {
    return await fn();
  } finally {
    activeAnalyses.delete(id);
  }
}
