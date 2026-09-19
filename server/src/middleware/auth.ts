import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Optional bearer-token authentication.
 *
 * If the AUTH_TOKEN environment variable is set, all API requests MUST include
 * `Authorization: Bearer <token>`. If AUTH_TOKEN is not set, the middleware
 * passes through — suitable for localhost development.
 *
 * Scope this middleware to the `/api` mount point so that static files and
 * the SPA fallback remain accessible without credentials (see server/src/index.ts).
 */

const RAW_TOKEN = process.env.AUTH_TOKEN;
const AUTH_TOKEN = RAW_TOKEN?.trim() || undefined;

/**
 * Compare two strings in constant time to prevent timing side-channel
 * attacks on the auth token comparison.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function auth(req: Request, res: Response, next: NextFunction): void {
  if (!AUTH_TOKEN) {
    // No auth configured — allow all requests
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  // auth-scheme is case-insensitive per RFC 7235
  const schemeEnd = header.indexOf(' ');
  if (schemeEnd === -1) {
    res.status(401).json({ error: 'Invalid Authorization header format' });
    return;
  }

  const scheme = header.slice(0, schemeEnd);
  if (scheme.toLowerCase() !== 'bearer') {
    res.status(401).json({ error: 'Unsupported authorization scheme' });
    return;
  }

  const token = header.slice(schemeEnd + 1).trim();
  if (!constantTimeEqual(token, AUTH_TOKEN)) {
    res.status(401).json({ error: 'Invalid authentication token' });
    return;
  }

  next();
}
