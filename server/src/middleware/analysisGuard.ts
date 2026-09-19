import type { Request, Response, NextFunction } from 'express';

/**
 * Tracks in-flight analysis generation per portfolio.
 * Prevents multiple simultaneous analysis generations for the same portfolio.
 */
const activeAnalyses = new Map<number, true>();

/**
 * Express middleware that rejects requests if an analysis is already
 * being generated for the given portfolio. Sets the lock if clear.
 */
export function analysisGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = parseInt(req.params.id, 10);
  if (activeAnalyses.has(id)) {
    res.status(409).json({ error: 'Analysis already in progress for this portfolio' });
    return;
  }
  activeAnalyses.set(id, true);
  next();
}

/** Remove the in-flight lock for a portfolio. Call in finally. */
export function releaseAnalysisLock(portfolioId: number): void {
  activeAnalyses.delete(portfolioId);
}
