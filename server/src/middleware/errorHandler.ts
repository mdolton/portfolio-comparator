import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Framework and middleware errors (e.g. body-parser) attach their HTTP status
// as `status` or `statusCode` on the error object.
type HttpError = Error & { status?: number; statusCode?: number };

function statusOf(err: HttpError): number {
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  return 500;
}

export function errorHandler(
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  const status = err instanceof AppError ? err.statusCode : statusOf(err);

  if (status >= 500) {
    console.error('Unhandled error:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
  // Client errors (bad JSON, oversized bodies, 404s): the message is safe to
  // surface, and there is nothing worth logging server-side.
  res.status(status).json({ error: err.message });
}
