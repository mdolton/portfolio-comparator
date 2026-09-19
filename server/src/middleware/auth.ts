import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

const AUTH_TOKEN = process.env.AUTH_TOKEN;

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!AUTH_TOKEN) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'Authorization header is required');
  }

  const token = authHeader.substring(7);
  if (token !== AUTH_TOKEN) {
    throw new AppError(401, 'Invalid authorization token');
  }

  next();
}
