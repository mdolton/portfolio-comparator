import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

const ALLOWED_HOSTS = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(',').map(h => h.trim().toLowerCase())
  : ['localhost', '127.0.0.1', '::1'];

export function hostValidationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const host = req.headers.host;
  
  if (!host) {
    throw new AppError(403, 'Forbidden: Host header is required');
  }
  
  const hostWithoutPort = new URL(`http://${host}`).hostname;
  const normalizedHost = hostWithoutPort.toLowerCase().replace(/\.$/, '');
  
  if (!ALLOWED_HOSTS.includes(normalizedHost)) {
    throw new AppError(403, 'Forbidden: Host header validation failed');
  }
  
  next();
}
