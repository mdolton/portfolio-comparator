import type { Request, Response, NextFunction } from 'express';

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authToken = process.env.AUTH_TOKEN;

  // If no AUTH_TOKEN is set, allow requests (for localhost development)
  if (!authToken) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  if (token !== authToken) {
    res.status(401).json({ error: 'Invalid authorization token' });
    return;
  }

  next();
}
