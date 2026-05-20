# Portfolio Cash Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track a per-portfolio cash balance as dated ledger transactions (deposit/withdrawal/dividend plus the derived cash effect of buys/sells), and include cash as a position in valuation, the performance chart, and AI analysis.

**Architecture:** Cash is never stored as a scalar — it is derived by summing each transaction's cash effect. Pure, DB-free math lives in a new `server/src/services/portfolioMath.ts` (unit-tested with Vitest); `transactionService`/`performanceService`/`holdingsEnrichment` call into it. The `transactions` table gains new `type` values and an `amount` column via a SQLite table-rebuild migration. Negative cash is allowed (no funding constraint).

**Tech Stack:** TypeScript, Express 5, better-sqlite3, React 19, Vite, Vitest (new).

**Spec:** `docs/superpowers/specs/2026-05-20-portfolio-cash-ledger-design.md`

---

## Verification model (read first)

The repo has no server type-check in CI (`tsc -b` covers `src` + `shared` only; the server runs via `tsx`). So per-task verification differs by layer:

- **Pure logic (portfolioMath):** `npx vitest run` — the primary green signal.
- **Server services/routes/db:** `npm run lint` + Vitest (pure parts) + manual run. These files are not type-checked by any build; correctness rides on tests + manual smoke.
- **Shared types + frontend:** `npm run build` (this is where `tsc -b` runs) + `npm run lint`.

**Expected transient state:** After Task 2 widens `shared/types.ts`, `npm run build` will FAIL (frontend not yet updated) until Tasks 13–15. That is expected; backend tasks (3–12) are verified by `npx vitest run` + `npm run lint`, and the final task confirms a fully green `npm run build`.

There is a pre-existing `tsc -p server/tsconfig.json` rootDir warning (`shared/types.ts` outside `rootDir`) on `main` — do **not** use server `tsc` as a gate; it is unrelated to this work.

---

## File structure

- **Create** `server/src/services/portfolioMath.ts` — pure cash/holdings/valuation math (only `import type` deps).
- **Create** `server/src/services/portfolioMath.test.ts` — Vitest unit tests.
- **Create** `vitest.config.ts` — node env, `server/**/*.test.ts`.
- **Modify** `package.json` — add `vitest` devDep + `test` script.
- **Modify** `shared/types.ts` — widen transaction/portfolio types.
- **Modify** `server/src/db.ts` — new schema + table-rebuild migration.
- **Modify** `server/src/services/transactionService.ts` — delegate to portfolioMath; type-aware `addTransaction`.
- **Modify** `server/src/services/holdingsEnrichment.ts` — `cash`, `securitiesValue`, cash-inclusive `totalValue`.
- **Modify** `server/src/services/performanceService.ts` — cash in per-date value.
- **Modify** `server/src/services/analysisService.ts` — cash in payload + system prompt.
- **Modify** `server/src/routes/transactions.ts` — per-type validation.
- **Modify** `src/components/TransactionForm.tsx` — type-driven fields.
- **Modify** `src/components/TransactionTable.tsx` — render all types + cash effect.
- **Modify** `src/components/HoldingsSummary.tsx` — cash row + headline/P&L split.
- **Modify** `src/components/PortfolioDetail.tsx` — pass new props.

---

### Task 1: Vitest setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `server/src/services/portfolioMath.test.ts` (temporary sanity test)

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest@^3.2.0`
Expected: `package.json` devDependencies gains `vitest`; install succeeds.

- [ ] **Step 2: Add the `test` script**

In `package.json`, add to `"scripts"` (after `"lint"`):

```json
    "test": "vitest run",
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Add a sanity test**

Create `server/src/services/portfolioMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run`
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts server/src/services/portfolioMath.test.ts
git commit -m "test: add Vitest with node config"
```

---

### Task 2: Widen shared types

**Files:**
- Modify: `shared/types.ts`

- [ ] **Step 1: Replace the `Transaction` interface and add `TransactionType`**

In `shared/types.ts`, replace the existing `Transaction` interface (lines 8–17) with:

```ts
export type TransactionType = 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'dividend';

export interface Transaction {
  id: number;
  portfolio_id: number;
  type: TransactionType;
  ticker: string | null;
  shares: number | null;
  price: number | null;
  amount: number | null;
  date: string;
  created_at: string;
}
```

- [ ] **Step 2: Add cash fields to `PortfolioWithHoldings`**

Replace the existing `PortfolioWithHoldings` interface with:

```ts
export interface PortfolioWithHoldings extends Portfolio {
  holdings: Holding[];
  securitiesValue: number | null;
  totalValue: number | null;
  totalCost: number;
  cash: number;
}
```

- [ ] **Step 3: Widen `CreateTransactionRequest`**

Replace the existing `CreateTransactionRequest` interface with:

```ts
export interface CreateTransactionRequest {
  type: TransactionType;
  ticker?: string | null;
  shares?: number | null;
  price?: number | null;
  amount?: number | null;
  date: string;
}
```

- [ ] **Step 4: Verify lint (build is expected to break until frontend tasks)**

Run: `npm run lint`
Expected: PASS. (`npm run build` will now fail on `TransactionTable.tsx` — expected; restored in Tasks 13–15.)

- [ ] **Step 5: Commit**

```bash
git add shared/types.ts
git commit -m "feat: widen transaction and portfolio types for cash ledger"
```

---

### Task 3: portfolioMath — `cashDelta` + `computeCashBalance` (TDD)

**Files:**
- Create: `server/src/services/portfolioMath.ts`
- Modify: `server/src/services/portfolioMath.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `server/src/services/portfolioMath.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../../shared/types.js';
import { cashDelta, computeCashBalance } from './portfolioMath';

let nextId = 1;
function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: nextId++,
    portfolio_id: 1,
    type: 'buy',
    ticker: null,
    shares: null,
    price: null,
    amount: null,
    date: '2024-01-01',
    created_at: '',
    ...partial,
  } as Transaction;
}

describe('cashDelta', () => {
  it('is negative cost for a buy', () => {
    expect(cashDelta(tx({ type: 'buy', shares: 10, price: 5 }))).toBe(-50);
  });
  it('is positive proceeds for a sell', () => {
    expect(cashDelta(tx({ type: 'sell', shares: 10, price: 5 }))).toBe(50);
  });
  it('adds for deposit and dividend', () => {
    expect(cashDelta(tx({ type: 'deposit', amount: 100 }))).toBe(100);
    expect(cashDelta(tx({ type: 'dividend', amount: 7 }))).toBe(7);
  });
  it('subtracts for withdrawal', () => {
    expect(cashDelta(tx({ type: 'withdrawal', amount: 30 }))).toBe(-30);
  });
});

describe('computeCashBalance', () => {
  it('sums all deltas', () => {
    const txs = [
      tx({ type: 'deposit', amount: 1000, date: '2024-01-01' }),
      tx({ type: 'buy', shares: 10, price: 20, date: '2024-01-02' }),
      tx({ type: 'dividend', amount: 5, date: '2024-01-03' }),
      tx({ type: 'sell', shares: 4, price: 25, date: '2024-01-04' }),
    ];
    // 1000 - 200 + 5 + 100
    expect(computeCashBalance(txs)).toBe(905);
  });
  it('respects the asOf date (inclusive)', () => {
    const txs = [
      tx({ type: 'deposit', amount: 1000, date: '2024-01-01' }),
      tx({ type: 'buy', shares: 10, price: 20, date: '2024-01-05' }),
    ];
    expect(computeCashBalance(txs, '2024-01-03')).toBe(1000);
    expect(computeCashBalance(txs, '2024-01-05')).toBe(800);
  });
  it('can go negative', () => {
    expect(computeCashBalance([tx({ type: 'buy', shares: 1, price: 10 })])).toBe(-10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run`
Expected: FAIL — `cashDelta`/`computeCashBalance` not exported (module `./portfolioMath` not found).

- [ ] **Step 3: Implement `portfolioMath.ts`**

Create `server/src/services/portfolioMath.ts`:

```ts
import type { Transaction } from '../../../shared/types.js';

/** Cash impact of a single transaction. */
export function cashDelta(
  tx: Pick<Transaction, 'type' | 'shares' | 'price' | 'amount'>,
): number {
  switch (tx.type) {
    case 'buy':
      return -((tx.shares ?? 0) * (tx.price ?? 0));
    case 'sell':
      return (tx.shares ?? 0) * (tx.price ?? 0);
    case 'deposit':
    case 'dividend':
      return tx.amount ?? 0;
    case 'withdrawal':
      return -(tx.amount ?? 0);
    default:
      return 0;
  }
}

/** Cash balance from summing deltas, optionally only through `asOf` (inclusive). */
export function computeCashBalance(
  txs: Array<Pick<Transaction, 'type' | 'shares' | 'price' | 'amount' | 'date'>>,
  asOf?: string,
): number {
  return txs.reduce(
    (sum, tx) => (asOf && tx.date > asOf ? sum : sum + cashDelta(tx)),
    0,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (all cashDelta + computeCashBalance tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/portfolioMath.ts server/src/services/portfolioMath.test.ts
git commit -m "feat: add cashDelta and computeCashBalance"
```

---

### Task 4: portfolioMath — `computeHoldings` (TDD)

**Files:**
- Modify: `server/src/services/portfolioMath.ts`
- Modify: `server/src/services/portfolioMath.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `server/src/services/portfolioMath.test.ts` (and add `computeHoldings` to the existing import from `./portfolioMath`):

```ts
import { computeHoldings } from './portfolioMath';

describe('computeHoldings', () => {
  it('aggregates buys and sells into positions, ignoring cash entries', () => {
    const txs = [
      tx({ type: 'deposit', amount: 1000, date: '2024-01-01' }),
      tx({ type: 'buy', ticker: 'AAPL', shares: 10, price: 100, date: '2024-01-02' }),
      tx({ type: 'buy', ticker: 'AAPL', shares: 10, price: 120, date: '2024-01-03' }),
      tx({ type: 'sell', ticker: 'AAPL', shares: 5, price: 130, date: '2024-01-04' }),
      tx({ type: 'dividend', ticker: 'AAPL', amount: 12, date: '2024-01-05' }),
    ];
    const holdings = computeHoldings(txs);
    expect(holdings).toHaveLength(1);
    const aapl = holdings[0];
    expect(aapl.ticker).toBe('AAPL');
    expect(aapl.shares).toBe(15);
    // cost basis: 2200 total, sell removes 5 * (2200/20)=550 -> 1650
    expect(aapl.totalCost).toBeCloseTo(1650);
    expect(aapl.avgCost).toBeCloseTo(110);
    expect(aapl.currentPrice).toBeNull();
  });

  it('drops fully-sold positions', () => {
    const txs = [
      tx({ type: 'buy', ticker: 'MSFT', shares: 5, price: 10, date: '2024-01-01' }),
      tx({ type: 'sell', ticker: 'MSFT', shares: 5, price: 12, date: '2024-01-02' }),
    ];
    expect(computeHoldings(txs)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run`
Expected: FAIL — `computeHoldings` is not exported.

- [ ] **Step 3: Implement `computeHoldings`**

Append to `server/src/services/portfolioMath.ts`:

```ts
import type { Holding } from '../../../shared/types.js';

/** Derive current securities positions from buy/sell transactions only. */
export function computeHoldings(txs: Transaction[]): Holding[] {
  const map = new Map<string, { shares: number; totalCost: number }>();

  for (const tx of txs) {
    if (tx.type !== 'buy' && tx.type !== 'sell') continue;
    if (!tx.ticker || tx.shares == null || tx.price == null) continue;

    const current = map.get(tx.ticker) ?? { shares: 0, totalCost: 0 };
    if (tx.type === 'buy') {
      current.totalCost += tx.shares * tx.price;
      current.shares += tx.shares;
    } else {
      if (current.shares > 0) {
        const costPerShare = current.totalCost / current.shares;
        current.totalCost -= tx.shares * costPerShare;
      }
      current.shares -= tx.shares;
    }
    map.set(tx.ticker, current);
  }

  const holdings: Holding[] = [];
  for (const [ticker, data] of map) {
    if (data.shares < 1e-9) continue;
    holdings.push({
      ticker,
      shares: data.shares,
      avgCost: data.totalCost / data.shares,
      totalCost: data.totalCost,
      currentPrice: null,
      marketValue: null,
      gainLoss: null,
      gainLossPercent: null,
    });
  }
  return holdings;
}
```

> Merge the new `import type { Holding }` with the existing `import type { Transaction }` line if your linter prefers a single import: `import type { Transaction, Holding } from '../../../shared/types.js';`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/portfolioMath.ts server/src/services/portfolioMath.test.ts
git commit -m "feat: add computeHoldings (cash entries ignored)"
```

---

### Task 5: portfolioMath — `negativeShareViolation` (TDD)

**Files:**
- Modify: `server/src/services/portfolioMath.ts`
- Modify: `server/src/services/portfolioMath.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `server/src/services/portfolioMath.test.ts` (add `negativeShareViolation` to the import):

```ts
import { negativeShareViolation } from './portfolioMath';

describe('negativeShareViolation', () => {
  it('returns null when balances stay non-negative', () => {
    const trades = [
      tx({ type: 'buy', ticker: 'AAPL', shares: 10, date: '2024-01-01' }),
      tx({ type: 'sell', ticker: 'AAPL', shares: 10, date: '2024-01-02' }),
    ];
    expect(negativeShareViolation(trades)).toBeNull();
  });

  it('flags a sell that exceeds holdings', () => {
    const trades = [
      tx({ type: 'buy', ticker: 'AAPL', shares: 5, date: '2024-01-01' }),
      tx({ type: 'sell', ticker: 'AAPL', shares: 8, date: '2024-01-02' }),
    ];
    const v = negativeShareViolation(trades);
    expect(v).not.toBeNull();
    expect(v?.ticker).toBe('AAPL');
    expect(v?.date).toBe('2024-01-02');
    expect(v?.balance).toBeCloseTo(-3);
  });

  it('ignores cash transactions', () => {
    const trades = [
      tx({ type: 'withdrawal', amount: 9999, date: '2024-01-01' }),
      tx({ type: 'buy', ticker: 'AAPL', shares: 1, date: '2024-01-02' }),
    ];
    expect(negativeShareViolation(trades)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run`
Expected: FAIL — `negativeShareViolation` not exported.

- [ ] **Step 3: Implement `negativeShareViolation`**

Append to `server/src/services/portfolioMath.ts`:

```ts
/** First sell that would drive a ticker's share balance negative, or null. */
export function negativeShareViolation(
  trades: Array<Pick<Transaction, 'type' | 'ticker' | 'shares' | 'date'>>,
): { ticker: string; date: string; balance: number } | null {
  const EPSILON = 1e-9;
  const balanceByTicker = new Map<string, number>();

  const sorted = trades
    .filter((t) => t.type === 'buy' || t.type === 'sell')
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      if (a.type === 'buy' && b.type === 'sell') return -1;
      if (a.type === 'sell' && b.type === 'buy') return 1;
      return 0;
    });

  for (const tx of sorted) {
    if (!tx.ticker || tx.shares == null) continue;
    const current = balanceByTicker.get(tx.ticker) ?? 0;
    const newBalance = tx.type === 'buy' ? current + tx.shares : current - tx.shares;
    if (newBalance < -EPSILON) {
      return { ticker: tx.ticker, date: tx.date, balance: newBalance };
    }
    balanceByTicker.set(tx.ticker, newBalance);
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/portfolioMath.ts server/src/services/portfolioMath.test.ts
git commit -m "feat: add negativeShareViolation share-balance check"
```

---

### Task 6: portfolioMath — `holdingsAtDate` + `portfolioValueAtDate` (TDD)

**Files:**
- Modify: `server/src/services/portfolioMath.ts`
- Modify: `server/src/services/portfolioMath.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `server/src/services/portfolioMath.test.ts` (add `holdingsAtDate, portfolioValueAtDate` to the import):

```ts
import { holdingsAtDate, portfolioValueAtDate } from './portfolioMath';

describe('holdingsAtDate', () => {
  it('returns share balances as of a date (inclusive)', () => {
    const txs = [
      tx({ type: 'buy', ticker: 'AAPL', shares: 10, price: 100, date: '2024-01-01' }),
      tx({ type: 'sell', ticker: 'AAPL', shares: 4, price: 110, date: '2024-01-05' }),
    ];
    expect(holdingsAtDate(txs, '2024-01-03').get('AAPL')).toBe(10);
    expect(holdingsAtDate(txs, '2024-01-05').get('AAPL')).toBe(6);
  });
});

describe('portfolioValueAtDate', () => {
  it('adds priced securities to the cash balance at the date', () => {
    const txs = [
      tx({ type: 'deposit', amount: 1000, date: '2024-01-01' }),
      tx({ type: 'buy', ticker: 'AAPL', shares: 5, price: 100, date: '2024-01-02' }),
    ];
    const prices = new Map([['AAPL', 120]]);
    // cash: 1000 - 500 = 500; securities: 5 * 120 = 600
    expect(portfolioValueAtDate(txs, prices, '2024-01-02')).toBe(1100);
  });

  it('skips securities with no known price but still counts cash', () => {
    const txs = [
      tx({ type: 'deposit', amount: 200, date: '2024-01-01' }),
      tx({ type: 'buy', ticker: 'XYZ', shares: 1, price: 50, date: '2024-01-02' }),
    ];
    const prices = new Map<string, number>();
    // securities unpriced -> 0; cash: 200 - 50 = 150
    expect(portfolioValueAtDate(txs, prices, '2024-01-02')).toBe(150);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run`
Expected: FAIL — `holdingsAtDate`/`portfolioValueAtDate` not exported.

- [ ] **Step 3: Implement both functions**

Append to `server/src/services/portfolioMath.ts`:

```ts
/** Share balances per ticker from trades dated on/before `date`. */
export function holdingsAtDate(txs: Transaction[], date: string): Map<string, number> {
  const holdings = new Map<string, number>();

  const relevant = txs
    .filter(
      (tx) =>
        (tx.type === 'buy' || tx.type === 'sell') &&
        tx.date <= date &&
        !!tx.ticker &&
        tx.shares != null,
    )
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      if (a.type === 'buy' && b.type === 'sell') return -1;
      if (a.type === 'sell' && b.type === 'buy') return 1;
      return 0;
    });

  for (const tx of relevant) {
    const current = holdings.get(tx.ticker!) ?? 0;
    holdings.set(tx.ticker!, tx.type === 'buy' ? current + tx.shares! : current - tx.shares!);
  }

  for (const [ticker, shares] of holdings) {
    if (shares < 1e-9) holdings.delete(ticker);
  }
  return holdings;
}

/** Portfolio value at a date: priced securities + cash balance at that date. */
export function portfolioValueAtDate(
  txs: Transaction[],
  pricesAtDate: Map<string, number>,
  date: string,
): number {
  let value = 0;
  for (const [ticker, shares] of holdingsAtDate(txs, date)) {
    const price = pricesAtDate.get(ticker);
    if (price !== undefined) value += shares * price;
  }
  return value + computeCashBalance(txs, date);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (all portfolioMath tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/portfolioMath.ts server/src/services/portfolioMath.test.ts
git commit -m "feat: add holdingsAtDate and portfolioValueAtDate"
```

---

### Task 7: Database schema + migration

**Files:**
- Modify: `server/src/db.ts`

- [ ] **Step 1: Update the `transactions` CREATE TABLE to the new schema**

In `server/src/db.ts`, replace the `CREATE TABLE IF NOT EXISTS transactions (...)` block inside the `db.exec(...)` template with:

```sql
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
```

- [ ] **Step 2: Add the table-rebuild migration**

In `server/src/db.ts`, immediately after the existing notes-column migration `try { ... } catch { ... }` block (and before `export default db;`), add:

```ts
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
```

- [ ] **Step 3: Verify the migration against your existing DB**

Run: `npm run dev --prefix server`
Expected: server starts on port 3001 with no errors. Stop it (Ctrl-C).

Run: `sqlite3 server/data/portfolio.db "PRAGMA table_info(transactions);"`
Expected: column list includes `amount`; existing buy/sell rows still present:
Run: `sqlite3 server/data/portfolio.db "SELECT count(*) FROM transactions;"` (count unchanged from before).

- [ ] **Step 4: Commit**

```bash
git add server/src/db.ts
git commit -m "feat: migrate transactions schema for cash ledger"
```

---

### Task 8: Wire `transactionService` to portfolioMath

**Files:**
- Modify: `server/src/services/transactionService.ts`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `server/src/services/transactionService.ts` with:

```ts
import db from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Transaction, Holding, TransactionType } from '../../../shared/types.js';
import { computeHoldings, computeCashBalance, negativeShareViolation } from './portfolioMath.js';

export function getTransactionsByPortfolio(portfolioId: number): Transaction[] {
  return db
    .prepare('SELECT * FROM transactions WHERE portfolio_id = ? ORDER BY date ASC, type ASC')
    .all(portfolioId) as Transaction[];
}

export interface NewTransactionInput {
  type: TransactionType;
  ticker?: string | null;
  shares?: number | null;
  price?: number | null;
  amount?: number | null;
  date: string;
}

export function addTransaction(portfolioId: number, input: NewTransactionInput): Transaction {
  const isTrade = input.type === 'buy' || input.type === 'sell';

  if (isTrade) {
    const existing = getTransactionsByPortfolio(portfolioId);
    const proposed = [
      ...existing,
      { type: input.type, ticker: input.ticker ?? null, shares: input.shares ?? null, date: input.date },
    ];
    const violation = negativeShareViolation(proposed);
    if (violation) {
      throw new AppError(
        400,
        `Cannot complete: would result in negative shares for ${violation.ticker} on ${violation.date} (balance would be ${violation.balance.toFixed(4)})`,
      );
    }
  }

  const ticker = input.ticker ? input.ticker.toUpperCase() : null;
  const result = db
    .prepare(
      'INSERT INTO transactions (portfolio_id, type, ticker, shares, price, amount, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      portfolioId,
      input.type,
      ticker,
      input.shares ?? null,
      input.price ?? null,
      input.amount ?? null,
      input.date,
    );

  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid) as Transaction;
}

export function deleteTransaction(transactionId: number): boolean {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId) as
    | Transaction
    | undefined;
  if (!tx) return false;

  const remaining = getTransactionsByPortfolio(tx.portfolio_id).filter((t) => t.id !== transactionId);
  const violation = negativeShareViolation(remaining);
  if (violation) {
    throw new AppError(
      400,
      `Cannot delete: would result in negative shares for ${violation.ticker} on ${violation.date} (balance would be ${violation.balance.toFixed(4)})`,
    );
  }

  const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(transactionId);
  return result.changes > 0;
}

export function getHoldings(portfolioId: number): Holding[] {
  return computeHoldings(getTransactionsByPortfolio(portfolioId));
}

export function getCashBalance(portfolioId: number): number {
  return computeCashBalance(getTransactionsByPortfolio(portfolioId));
}
```

- [ ] **Step 2: Verify lint + tests**

Run: `npm run lint`
Expected: PASS.
Run: `npx vitest run`
Expected: PASS (portfolioMath tests unaffected).

- [ ] **Step 3: Commit**

```bash
git add server/src/services/transactionService.ts
git commit -m "refactor: delegate transactionService to portfolioMath; type-aware addTransaction"
```

---

### Task 9: `holdingsEnrichment` — cash + securitiesValue

**Files:**
- Modify: `server/src/services/holdingsEnrichment.ts`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `server/src/services/holdingsEnrichment.ts` with:

```ts
import * as transactionService from './transactionService.js';
import * as marketService from './marketService.js';
import type { Holding } from '../../../shared/types.js';

export interface EnrichedHoldings {
  holdings: Holding[];
  securitiesValue: number | null;
  totalCost: number;
  cash: number;
  totalValue: number | null;
}

export async function getEnrichedHoldings(portfolioId: number): Promise<EnrichedHoldings> {
  const holdings = transactionService.getHoldings(portfolioId);

  let securitiesValue: number | null = 0;
  for (const holding of holdings) {
    try {
      const quote = await marketService.getQuote(holding.ticker);
      holding.currentPrice = quote.price;
      holding.marketValue = holding.shares * quote.price;
      holding.gainLoss = holding.marketValue - holding.totalCost;
      holding.gainLossPercent =
        holding.totalCost > 0 ? (holding.gainLoss / holding.totalCost) * 100 : null;
      if (securitiesValue !== null) securitiesValue += holding.marketValue;
    } catch {
      securitiesValue = null;
    }
  }

  const cash = transactionService.getCashBalance(portfolioId);
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalValue = securitiesValue === null ? null : securitiesValue + cash;

  return { holdings, securitiesValue, totalCost, cash, totalValue };
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/holdingsEnrichment.ts
git commit -m "feat: include cash in enriched holdings valuation"
```

---

### Task 10: `performanceService` — cash in the chart

**Files:**
- Modify: `server/src/services/performanceService.ts`

- [ ] **Step 1: Replace the import line and the date loop; remove the local holdings function**

In `server/src/services/performanceService.ts`:

(a) Replace the import block at the top with:

```ts
import * as transactionService from './transactionService.js';
import * as portfolioService from './portfolioService.js';
import * as marketService from './marketService.js';
import type { PerformancePoint } from '../../../shared/types.js';
import { portfolioValueAtDate } from './portfolioMath.js';
```

(b) Replace the per-date loop (the `for (const date of dates) { ... }` block) with:

```ts
  for (const date of dates) {
    // Update last known prices for this date (forward-fill)
    for (const ticker of allTickers) {
      const tickerPrices = pricesByTicker.get(ticker);
      if (tickerPrices?.has(date)) {
        lastKnownPrice.set(ticker, tickerPrices.get(date)!);
      }
    }

    const point: PerformancePoint = { date };

    for (const { portfolio, transactions } of portfolioData) {
      if (!portfolio) continue;
      // Only plot once the portfolio has any activity (trade or cash) by this date
      if (!transactions.some((t) => t.date <= date)) continue;
      const value = portfolioValueAtDate(transactions, lastKnownPrice, date);
      point[portfolio.name] = Math.round(value * 100) / 100;
    }

    const portfolioKeys = Object.keys(point).filter((k) => k !== 'date');
    if (portfolioKeys.length > 0) {
      result.push(point);
    }
  }
```

(c) Delete the now-unused `calculateHoldingsAtDate` function at the bottom of the file.

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: PASS (no unused `calculateHoldingsAtDate` / `Transaction` import remaining).

- [ ] **Step 3: Commit**

```bash
git add server/src/services/performanceService.ts
git commit -m "feat: include cash balance in performance-over-time chart"
```

---

### Task 11: Route validation for new transaction types

**Files:**
- Modify: `server/src/routes/transactions.ts`

- [ ] **Step 1: Replace the POST handler**

In `server/src/routes/transactions.ts`, replace the `router.post('/portfolios/:id/transactions', ...)` handler with:

```ts
// POST /api/portfolios/:id/transactions
router.post('/portfolios/:id/transactions', (req, res) => {
  const portfolioId = parseInt(req.params.id);
  const portfolio = portfolioService.getPortfolioById(portfolioId);
  if (!portfolio) throw new AppError(404, 'Portfolio not found');

  const { type, ticker, shares, price, amount, date } = req.body;

  const TYPES = ['buy', 'sell', 'deposit', 'withdrawal', 'dividend'];
  if (!TYPES.includes(type)) throw new AppError(400, 'Invalid transaction type');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, 'Date must be in YYYY-MM-DD format');
  }

  const isTrade = type === 'buy' || type === 'sell';
  if (isTrade) {
    if (!ticker || typeof ticker !== 'string') throw new AppError(400, 'Valid ticker is required');
    if (typeof shares !== 'number' || shares <= 0) throw new AppError(400, 'Shares must be a positive number');
    if (typeof price !== 'number' || price <= 0) throw new AppError(400, 'Price must be a positive number');
  } else {
    if (typeof amount !== 'number' || amount <= 0) throw new AppError(400, 'Amount must be a positive number');
    if (type === 'dividend' && ticker != null && typeof ticker !== 'string') {
      throw new AppError(400, 'Ticker must be a string');
    }
  }

  const transaction = transactionService.addTransaction(portfolioId, {
    type,
    date,
    ticker: isTrade || (type === 'dividend' && ticker) ? ticker : null,
    shares: isTrade ? shares : null,
    price: isTrade ? price : null,
    amount: isTrade ? null : amount,
  });
  res.status(201).json(transaction);
});
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/transactions.ts
git commit -m "feat: validate cash transaction types in route"
```

---

### Task 12: `analysisService` — cash in payload + prompt

**Files:**
- Modify: `server/src/services/analysisService.ts`

- [ ] **Step 1: Add cash awareness to the system prompt**

In `server/src/services/analysisService.ts`, in `SYSTEM_PROMPT`, append this sentence to the end of the **first paragraph** (right after "...how the holdings align with the stated thesis."):

```
 Treat the cash balance as a position: weigh cash allocation (uninvested dry powder), and account for deposits, withdrawals, and dividend income. A negative cash balance indicates margin/borrowing.
```

- [ ] **Step 2: Add cash + new fields to the payload**

Replace the `const userPayload = { ... }` object with:

```ts
  const userPayload = {
    notes: portfolio.notes ?? '',
    totals: {
      cost: enriched.totalCost,
      securitiesValue: enriched.securitiesValue,
      cash: enriched.cash,
      value: enriched.totalValue,
    },
    holdings: enriched.holdings.map((h) => ({
      ticker: h.ticker,
      shares: h.shares,
      avgCost: h.avgCost,
      totalCost: h.totalCost,
      currentPrice: h.currentPrice,
      marketValue: h.marketValue,
      gainLoss: h.gainLoss,
      gainLossPercent: h.gainLossPercent,
    })),
    transactions: transactions.map((t) => ({
      type: t.type,
      ticker: t.ticker,
      shares: t.shares,
      price: t.price,
      amount: t.amount,
      date: t.date,
    })),
  };
```

- [ ] **Step 3: Verify lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/analysisService.ts
git commit -m "feat: include cash and ledger activity in AI analysis payload"
```

---

### Task 13: Frontend — `TransactionForm` type-driven fields

**Files:**
- Modify: `src/components/TransactionForm.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/components/TransactionForm.tsx` with:

```tsx
import { useState } from 'react';
import { TickerSearchInput } from './TickerSearchInput';
import type { CreateTransactionRequest, TransactionType } from '@shared/types';

interface Props {
  onSubmit: (data: CreateTransactionRequest) => Promise<void>;
}

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'dividend', label: 'Dividend' },
];

export function TransactionForm({ onSubmit }: Props) {
  const [type, setType] = useState<TransactionType>('buy');
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isTrade = type === 'buy' || type === 'sell';
  const isDividend = type === 'dividend';
  const isCash = type === 'deposit' || type === 'withdrawal';

  const canSubmit = isTrade ? !!ticker && !!shares && !!price : !!amount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !canSubmit) return;

    try {
      setSubmitting(true);
      setError(null);
      const payload: CreateTransactionRequest = isTrade
        ? { type, ticker: ticker.toUpperCase(), shares: parseFloat(shares), price: parseFloat(price), date }
        : { type, amount: parseFloat(amount), date, ticker: isDividend && ticker ? ticker.toUpperCase() : null };
      await onSubmit(payload);
      setTicker('');
      setShares('');
      setPrice('');
      setAmount('');
      setType('buy');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1rem' }}>
      <h3 style={{ marginBottom: '0.75rem' }}>Add Transaction</h3>
      {error && <div className="error-message">{error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as TransactionType)} style={{ width: '100%' }}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {(isTrade || isDividend) && (
          <div className="form-group">
            <label>Ticker{isDividend ? ' (optional)' : ''}</label>
            <TickerSearchInput value={ticker} onChange={setTicker} />
          </div>
        )}

        {isTrade && (
          <>
            <div className="form-group">
              <label>Shares</label>
              <input type="number" step="any" min="0.0001" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="0" style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label>Price</label>
              <input type="number" step="any" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" style={{ width: '100%' }} />
            </div>
          </>
        )}

        {(isCash || isDividend) && (
          <div className="form-group">
            <label>Amount</label>
            <input type="number" step="any" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ width: '100%' }} />
          </div>
        )}

        <div className="form-group">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>
      <button type="submit" className="btn-primary" disabled={submitting || !canSubmit}>
        {submitting ? 'Adding...' : 'Add Transaction'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit (build verified at Task 15)**

```bash
git add src/components/TransactionForm.tsx
git commit -m "feat: support cash transaction types in the form"
```

> `npm run build` is still red here because `TransactionTable.tsx` is updated next. Both land before the Task 15 verification.

---

### Task 14: Frontend — `TransactionTable` renders all types

**Files:**
- Modify: `src/components/TransactionTable.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/components/TransactionTable.tsx` with:

```tsx
import type { Transaction } from '@shared/types';
import { formatCurrency, formatShares, formatDate } from '../utils/formatting';

interface Props {
  transactions: Transaction[];
  onDelete: (id: number) => Promise<void>;
}

const TYPE_STYLES: Record<Transaction['type'], { bg: string; color: string }> = {
  buy: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
  sell: { bg: 'var(--danger-bg)', color: 'var(--danger-text)' },
  deposit: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
  withdrawal: { bg: 'var(--danger-bg)', color: 'var(--danger-text)' },
  dividend: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
};

function cashEffect(tx: Transaction): number {
  switch (tx.type) {
    case 'buy':
      return -((tx.shares ?? 0) * (tx.price ?? 0));
    case 'sell':
      return (tx.shares ?? 0) * (tx.price ?? 0);
    case 'withdrawal':
      return -(tx.amount ?? 0);
    default:
      return tx.amount ?? 0;
  }
}

export function TransactionTable({ transactions, onDelete }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <p>No transactions yet. Add one above.</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Ticker</th>
            <th>Type</th>
            <th>Shares</th>
            <th>Price</th>
            <th>Cash Effect</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const effect = cashEffect(tx);
            return (
              <tr key={tx.id}>
                <td>{formatDate(tx.date)}</td>
                <td style={{ fontWeight: 600 }}>{tx.ticker ?? '—'}</td>
                <td>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.125rem 0.5rem',
                      borderRadius: 12,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: TYPE_STYLES[tx.type].bg,
                      color: TYPE_STYLES[tx.type].color,
                    }}
                  >
                    {tx.type.toUpperCase()}
                  </span>
                </td>
                <td>{tx.shares != null ? formatShares(tx.shares) : '—'}</td>
                <td>{formatCurrency(tx.price)}</td>
                <td className={effect >= 0 ? 'positive' : 'negative'}>{formatCurrency(effect)}</td>
                <td>
                  <button
                    className="btn-danger btn-sm"
                    onClick={async () => {
                      try {
                        await onDelete(tx.id);
                      } catch (err) {
                        alert(err instanceof Error ? err.message : 'Failed to delete');
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit (build verified at Task 15)**

```bash
git add src/components/TransactionTable.tsx
git commit -m "feat: render cash transactions and signed cash effect"
```

---

### Task 15: Frontend — `HoldingsSummary` cash row + `PortfolioDetail` wiring

**Files:**
- Modify: `src/components/HoldingsSummary.tsx`
- Modify: `src/components/PortfolioDetail.tsx`

- [ ] **Step 1: Replace `HoldingsSummary.tsx`**

Replace the entire contents of `src/components/HoldingsSummary.tsx` with:

```tsx
import type { Holding } from '@shared/types';
import { formatCurrency, formatPercent, formatShares } from '../utils/formatting';

interface Props {
  holdings: Holding[];
  securitiesValue: number | null;
  cash: number;
  totalCost: number;
  totalValue: number | null;
}

export function HoldingsSummary({ holdings, securitiesValue, cash, totalCost, totalValue }: Props) {
  if (holdings.length === 0 && cash === 0) {
    return null;
  }

  const gainLoss = securitiesValue !== null ? securitiesValue - totalCost : null;
  const gainLossPercent = gainLoss !== null && totalCost > 0 ? (gainLoss / totalCost) * 100 : null;

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Current Holdings</h3>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatCurrency(totalValue)}</div>
          {gainLoss !== null && (
            <div className={gainLoss >= 0 ? 'positive' : 'negative'} style={{ fontSize: '0.875rem' }}>
              {formatCurrency(gainLoss)} ({formatPercent(gainLossPercent)}) · securities
            </div>
          )}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Shares</th>
              <th>Avg Cost</th>
              <th>Price</th>
              <th>Value</th>
              <th>Gain/Loss</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.ticker}>
                <td style={{ fontWeight: 600 }}>{h.ticker}</td>
                <td>{formatShares(h.shares)}</td>
                <td>{formatCurrency(h.avgCost)}</td>
                <td>{formatCurrency(h.currentPrice)}</td>
                <td>
                  {formatCurrency(h.marketValue)}
                  {h.marketValue !== null && totalValue !== null && totalValue > 0 && (
                    <span style={{ color: 'var(--color-muted)', marginLeft: '0.25rem' }}>
                      ({((h.marketValue / totalValue) * 100).toFixed(2)}%)
                    </span>
                  )}
                </td>
                <td>
                  {h.gainLoss !== null ? (
                    <span className={h.gainLoss >= 0 ? 'positive' : 'negative'}>
                      {formatCurrency(h.gainLoss)} ({formatPercent(h.gainLossPercent)})
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            <tr style={{ fontStyle: 'italic' }}>
              <td style={{ fontWeight: 600 }}>Cash</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>
                {formatCurrency(cash)}
                {totalValue !== null && totalValue > 0 && (
                  <span style={{ color: 'var(--color-muted)', marginLeft: '0.25rem' }}>
                    ({((cash / totalValue) * 100).toFixed(2)}%)
                  </span>
                )}
              </td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `PortfolioDetail.tsx` to pass the new props**

In `src/components/PortfolioDetail.tsx`, replace the `<HoldingsSummary ... />` element with:

```tsx
      <HoldingsSummary
        holdings={portfolio.holdings}
        securitiesValue={portfolio.securitiesValue}
        cash={portfolio.cash}
        totalCost={portfolio.totalCost}
        totalValue={portfolio.totalValue}
      />
```

- [ ] **Step 3: Verify the full build + lint**

Run: `npm run build`
Expected: PASS (`tsc -b` clean over `src` + `shared`, then `vite build` succeeds).
Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/HoldingsSummary.tsx src/components/PortfolioDetail.tsx
git commit -m "feat: show cash as a position row in holdings summary"
```

---

### Task 16: Full verification + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npx vitest run`
Expected: all portfolioMath tests PASS.
Run: `npm run build`
Expected: PASS.
Run: `npm run lint`
Expected: PASS.

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev` (frontend + backend). In the browser:

1. Open a portfolio. Confirm a **Cash** row appears in Current Holdings (likely negative for an existing portfolio with trades and no deposits — expected).
2. Add a **Deposit** (e.g. amount 10000, today). Confirm cash increases and the headline total value updates.
3. Add a **Buy**; confirm cash drops by `shares × price` and a securities row appears.
4. Add a **Sell**; confirm cash rises by proceeds.
5. Add a **Dividend** (optional ticker); confirm cash rises.
6. Add a **Withdrawal**; confirm cash drops.
7. Open the dashboard performance chart; confirm the funded portfolio's line reflects cash.
8. Click **Generate Analysis**; confirm it references the cash position and runs to completion.

Expected: all behaviors as described; no console/server errors.

- [ ] **Step 3: Final confirmation**

No commit (all work already committed). Report results; the branch `feat/portfolio-cash-ledger` is ready for review/PR.
