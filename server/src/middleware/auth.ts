import { createHash, timingSafeEqual } from 'node:crypto';
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
    res.set('WWW-Authenticate', 'Bearer');
    throw new AppError(401, 'Authorization header is required');
  }

  const token = authHeader.substring(7);
  
  const expectedHash = createHash('sha256').update(AUTH_TOKEN).digest();
  const receivedHash = createHash('sha256').update(token).digest();
  
  if (expectedHash.length !== receivedHash.length || 
      !timingSafeEqual(expectedHash, receivedHash)) {
    res.set('WWW-Authenticate', 'Bearer');
    throw new AppError(401, 'Invalid authorization token');
  }

  next();
}
