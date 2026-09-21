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

// Framework and middleware errors (e.g. body-parser, built on http-errors)
// attach their HTTP status as `status` or `statusCode`, and set `expose` when
// the message is intended for the client.
type HttpError = Error & { status?: number; statusCode?: number; expose?: boolean };

// Returns the status to surface for non-AppError client errors, or null when
// the error is not an explicit, safe-to-show 4xx (anything else is a 500).
function clientErrorStatus(err: HttpError): number | null {
  const status = typeof err.status === 'number' ? err.status : err.statusCode;
  if (typeof status !== 'number' || status < 400 || status >= 500) return null;
  // Express's router tags malformed percent-encoding in a route param (a
  // URIError) with status 400 but, unlike http-errors, never sets `expose`.
  if (err.expose === true || err instanceof URIError) return status;
  return null;
}

export function errorHandler(
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  // Deliberate errors raised by the app carry their own safe status + message.
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Client errors from the framework (malformed JSON, oversized bodies,
  // undecodable route params).
  const status = clientErrorStatus(err);
  if (status !== null) {
    res.status(status).json({ error: err.message });
    return;
  }

  console.error('Unhandled error:', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
}
