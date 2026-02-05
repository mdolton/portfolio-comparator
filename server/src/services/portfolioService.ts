import db from '../db.js';
import type { Portfolio } from '../../../shared/types.js';

export function getAllPortfolios(): Portfolio[] {
  return db.prepare('SELECT * FROM portfolios ORDER BY created_at DESC').all() as Portfolio[];
}

export function getPortfolioById(id: number): Portfolio | undefined {
  return db.prepare('SELECT * FROM portfolios WHERE id = ?').get(id) as Portfolio | undefined;
}

export function createPortfolio(name: string): Portfolio {
  const stmt = db.prepare('INSERT INTO portfolios (name) VALUES (?)');
  const result = stmt.run(name);
  return getPortfolioById(result.lastInsertRowid as number)!;
}

export function deletePortfolio(id: number): boolean {
  const result = db.prepare('DELETE FROM portfolios WHERE id = ?').run(id);
  return result.changes > 0;
}
