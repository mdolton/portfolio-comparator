import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

const activeAnalyses = new Map<number, boolean>();

export function isInFlight(portfolioId: number): boolean {
  return activeAnalyses.has(portfolioId);
}

export function startAnalysis(portfolioId: number): void {
  activeAnalyses.set(portfolioId, true);
}

export function endAnalysis(portfolioId: number): void {
  activeAnalyses.delete(portfolioId);
}

export function analysisGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = parseInt(req.params.id);
  if (isInFlight(id)) {
    throw new AppError(409, 'Analysis is already in progress for this portfolio');
  }
  next();
}
