import type { Request, Response, NextFunction } from 'express';

// Allowed hosts for development
const ALLOWED_HOSTS = ['localhost', '127.0.0.1'];

export function hostValidationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const host = req.headers.host;

  // Skip host validation in production (handled by reverse proxy)
  if (process.env.NODE_ENV === 'production') {
    next();
    return;
  }

  // In development, validate the host header to prevent DNS rebinding attacks
  if (host) {
    const hostWithoutPort = host.split(':')[0];

    if (!ALLOWED_HOSTS.includes(hostWithoutPort)) {
      res.status(403).json({ error: 'Forbidden: Invalid host header' });
      return;
    }
  }

  next();
}
