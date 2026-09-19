import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

export function hostValidationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const host = req.headers.host;
  
  if (!host) {
    next();
    return;
  }
  
  const allowedHosts = ['localhost', '127.0.0.1'];
  const hostWithoutPort = host.split(':')[0];
  
  if (!allowedHosts.includes(hostWithoutPort)) {
    throw new AppError(403, 'Forbidden: Host header validation failed');
  }
  
  next();
}
