import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'portfolio.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend')),
    ticker TEXT,
    shares REAL,
    price REAL,
    amount REAL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS price_cache (
    ticker TEXT NOT NULL,
    date TEXT NOT NULL,
    close_price REAL NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (ticker, date)
  );

  CREATE TABLE IF NOT EXISTS portfolio_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER NOT NULL UNIQUE,
    content TEXT NOT NULL,
    model TEXT NOT NULL,
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
  );
`);

// Migration: add notes column to existing databases
try {
  db.exec(`ALTER TABLE portfolios ADD COLUMN notes TEXT DEFAULT ''`);
} catch {
  // Column already exists
}

// Migration: rebuild transactions table to support cash transaction types + amount column
const txColumns = db.prepare(`PRAGMA table_info(transactions)`).all() as Array<{ name: string }>;
const hasAmount = txColumns.some((c) => c.name === 'amount');
if (!hasAmount) {
  db.pragma('foreign_keys = OFF');
  const rebuild = db.transaction(() => {
    db.exec(`ALTER TABLE transactions RENAME TO transactions_old;`);
    db.exec(`
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        portfolio_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend')),
        ticker TEXT,
        shares REAL,
        price REAL,
        amount REAL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
      );
    `);
    db.exec(`
      INSERT INTO transactions (id, portfolio_id, type, ticker, shares, price, amount, date, created_at)
      SELECT id, portfolio_id, type, ticker, shares, price, NULL, date, created_at FROM transactions_old;
    `);
    db.exec(`DROP TABLE transactions_old;`);
  });
  rebuild();
  db.pragma('foreign_keys = ON');
}

export default db;
