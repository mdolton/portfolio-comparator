import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

export function crossSiteGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const origin = req.headers.origin;
  const secFetchSite = req.headers['sec-fetch-site'];
  
  if (origin || secFetchSite) {
    if (secFetchSite === 'cross-site' || secFetchSite === 'remote') {
      throw new AppError(403, 'Forbidden: Cross-site requests not allowed');
    }
  }
  
  next();
}
