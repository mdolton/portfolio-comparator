import type { Request, Response, NextFunction } from 'express';

/**
 * Validates the Host header against an allow list to mitigate DNS rebinding
 * attacks.
 *
 * Default allow list covers localhost development. Extend with the
 * ALLOWED_HOSTS environment variable (comma-separated, case-insensitive).
 * Ports are stripped before comparison; IPv6 brackets are handled.
 */

const DEFAULT_ALLOWED = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Parse a Host header value into a hostname, stripping port and IPv6 brackets.
 *
 * - `localhost:3001`       → `localhost`
 * - `[::1]:3001`           → `::1`
 * - `192.168.1.50`         → `192.168.1.50`
 * - `portfolio.example.com` → `portfolio.example.com`
 */
function parseHostname(raw: string): string {
  let hostname = raw.trim().toLowerCase();
  // Strip port (IPv6-safe via URL parser)
  try {
    hostname = new URL(`http://${hostname}`).hostname;
  } catch {
    // If URL parsing fails (e.g. bare unbraced IPv6), fall through with trimmed value
  }
  return hostname;
}

/** Merge DEFAULT_ALLOWED with ALLOWED_HOSTS env var, computed once at module load. */
const RAW_ENV = process.env.ALLOWED_HOSTS;
const ALLOWED_HOSTS = new Set(DEFAULT_ALLOWED);
if (RAW_ENV) {
  for (const entry of RAW_ENV.split(',')) {
    const trimmed = entry.trim().toLowerCase();
    if (trimmed) ALLOWED_HOSTS.add(trimmed);
  }
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

  const hostname = parseHostname(raw);

  if (!ALLOWED_HOSTS.has(hostname)) {
    console.warn(`[hostValidation] Rejected request with Host: ${raw} (parsed: ${hostname})`);
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  next();
}
