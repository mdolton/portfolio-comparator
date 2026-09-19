import type { Request, Response, NextFunction } from 'express';

/**
 * Validates the Host header against an allow list to mitigate DNS rebinding
 * attacks.
 *
 * Default allow list covers localhost development. Override with the
 * ALLOWED_HOSTS environment variable (comma-separated). Ports are stripped
 * before comparison.
 */

const DEFAULT_ALLOWED = new Set(['localhost', '127.0.0.1', '::1']);

function getAllowedHosts(): Set<string> {
  const env = process.env.ALLOWED_HOSTS;
  if (!env) return DEFAULT_ALLOWED;
  return new Set(env.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean));
}

export function hostValidation(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const raw = req.headers.host;
  if (!raw) {
    res.status(400).json({ error: 'Host header is required' });
    return;
  }

  // Strip port from host header for matching
  const hostname = raw.split(':')[0].toLowerCase();
  const allowed = getAllowedHosts();

  if (!allowed.has(hostname)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  next();
}
