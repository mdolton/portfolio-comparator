import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

const activeAnalyses = new Set<number>();

export function isAnalysisActive(portfolioId: number): boolean {
  return activeAnalyses.has(portfolioId);
}

export function checkAndSetAnalysis(portfolioId: number): void {
  if (activeAnalyses.has(portfolioId)) {
    throw new AppError(409, 'Analysis is already in progress for this portfolio');
  }
  activeAnalyses.add(portfolioId);
}
