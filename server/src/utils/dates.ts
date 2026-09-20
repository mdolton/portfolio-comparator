const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** True for a YYYY-MM-DD string naming a real calendar date. Round-trips
 *  through Date so rollovers like 2024-02-31 (→ Mar 2) are rejected. */
export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Whole days from `start` to `end` (both valid YYYY-MM-DD). */
export function daysBetween(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / MS_PER_DAY;
}

/** Latest calendar date that is "today" somewhere on Earth. Timezones run up
 *  to UTC+14, so a user's local today is at most one day ahead of the UTC date. */
export function latestLocalToday(now: Date = new Date()): string {
  return new Date(now.getTime() + MS_PER_DAY).toISOString().slice(0, 10);
}
