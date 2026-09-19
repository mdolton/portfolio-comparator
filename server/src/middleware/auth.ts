import type { Request, Response, NextFunction } from 'express';

/**
 * Optional bearer-token authentication.
 *
 * If the AUTH_TOKEN environment variable is set, all requests MUST include
 * `Authorization: Bearer <token>`. If AUTH_TOKEN is not set, the middleware
 * passes through — suitable for localhost development.
 */

const AUTH_TOKEN = process.env.AUTH_TOKEN;

export function auth(req: Request, res: Response, next: NextFunction): void {
  if (!AUTH_TOKEN) {
    // No auth configured — allow all requests
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7).trim();
  if (token !== AUTH_TOKEN) {
    res.status(401).json({ error: 'Invalid authentication token' });
    return;
  }

  next();
}
