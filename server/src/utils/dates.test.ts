import { describe, it, expect } from 'vitest';
import { isValidISODate, daysBetween, latestLocalToday } from './dates';

describe('isValidISODate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidISODate('2024-01-02')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true);
  });

  it('rejects impossible calendar dates', () => {
    expect(isValidISODate('2024-02-31')).toBe(false);
    expect(isValidISODate('2023-02-29')).toBe(false);
    expect(isValidISODate('2024-04-31')).toBe(false);
    expect(isValidISODate('2024-13-01')).toBe(false);
    expect(isValidISODate('2024-00-10')).toBe(false);
  });

  it('rejects malformed or non-string input', () => {
    expect(isValidISODate('2024-1-2')).toBe(false);
    expect(isValidISODate('2024-01-02T00:00:00Z')).toBe(false);
    expect(isValidISODate('')).toBe(false);
    expect(isValidISODate(undefined)).toBe(false);
    expect(isValidISODate(20240102)).toBe(false);
  });
});

describe('daysBetween', () => {
  it('counts whole days, including across leap days', () => {
    expect(daysBetween('2024-01-01', '2024-01-01')).toBe(0);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2024-01-05', '2024-01-01')).toBe(-4);
  });
});

describe('latestLocalToday', () => {
  it('is one day ahead of the UTC date', () => {
    expect(latestLocalToday(new Date('2026-09-19T22:00:00Z'))).toBe('2026-09-20');
    expect(latestLocalToday(new Date('2026-12-31T00:00:00Z'))).toBe('2027-01-01');
  });
});
