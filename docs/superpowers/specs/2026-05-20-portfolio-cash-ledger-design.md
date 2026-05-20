# Portfolio Cash Ledger — Design

**Date:** 2026-05-20
**Status:** Approved (pending spec review)

## Goal

Track a cash balance per portfolio and include it as a position for valuation and
AI analysis. Cash is modeled as **dated transactions** (an integrated ledger), so
the balance is reconstructable at any point in time and flows correctly into the
performance-over-time chart.

## Decisions (resolved during brainstorming)

1. **Integrated ledger, not a scalar field.** Cash is derived from dated
   transactions, giving it history — chosen over a single editable `cash` number.
2. **Single row per event; cash effect derived by type.** A buy/sell is one row
   whose cash impact is computed (`∓ shares×price`); we do **not** store paired
   "cash leg + security leg" rows.
3. **Negative cash allowed.** No funding constraint — buys may drive cash negative
   (margin). Cash is informational; the user zeroes it by recording real deposits.
   Existing portfolios (which have trades but no deposits) will read negative until
   the user records their funding. This is acceptable and requires no data backfill.
4. **Gain/loss stays securities-only.** Cash contributes zero gain/loss. The
   headline total value includes cash; per-holding and portfolio P/L do not treat
   cash as profit.
5. **Cash displayed as a row** in the Current Holdings table.
6. **Vitest** added for the pure cash/holdings/valuation logic.

## Transaction model

`type` expands from `buy | sell` to **`buy | sell | deposit | withdrawal | dividend`**.
A nullable `amount` column holds the cash figure for cash-only entries.

| type | `ticker` | `shares` | `price` | `amount` | cash effect |
|---|---|---|---|---|---|
| `buy` | required | required >0 | required >0 | null | `−(shares×price)` |
| `sell` | required | required >0 | required >0 | null | `+(shares×price)` |
| `deposit` | null | null | null | required >0 | `+amount` |
| `withdrawal` | null | null | null | required >0 | `−amount` |
| `dividend` | optional | null | null | required >0 | `+amount` |

Per-type field requirements are enforced in the **route + service layers** (the
existing validation pattern). The DB keeps a light `CHECK` on the `type` enum only;
nullability of `ticker`/`shares`/`price` is relaxed.

### Schema

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

### Migration

The old table has `CHECK(type IN ('buy','sell'))`, `CHECK(shares>0)`,
`CHECK(price>0)`, and `ticker NOT NULL` — none of which SQLite can `ALTER` away.
`db.ts` detects the old schema (no `amount` column via `PRAGMA table_info`) and runs
the standard SQLite table-rebuild, alongside the existing notes-column migration:

1. `PRAGMA foreign_keys=OFF`
2. `BEGIN`
3. `ALTER TABLE transactions RENAME TO transactions_old`
4. create the new `transactions` table (schema above)
5. `INSERT INTO transactions (id, portfolio_id, type, ticker, shares, price, amount, date, created_at)
   SELECT id, portfolio_id, type, ticker, shares, price, NULL, date, created_at FROM transactions_old`
6. `DROP TABLE transactions_old`
7. `COMMIT`
8. `PRAGMA foreign_keys=ON`

Fresh databases get the new schema directly from `CREATE TABLE IF NOT EXISTS`; the
migration detector finds `amount` present and is a no-op. Nothing references
`transactions` via FK, so the rebuild is low-risk.

## Cash math (single source of truth)

Pure helpers in `transactionService`, testable without a DB:

```ts
cashDelta(tx): number          // per-type effect from the table above
computeCashBalance(txs, asOf?) // Σ cashDelta where !asOf || tx.date <= asOf
computeHoldings(txs)           // existing holdings logic, filtered to buy|sell
```

The DB-backed `getCashBalance(portfolioId)` and `getHoldings(portfolioId)` read rows
and delegate to the pure helpers. `computeHoldings` and `validateShareBalance` ignore
non-trade types, so cash entries never affect share counts.

## Valuation & enrichment

`EnrichedHoldings` / `PortfolioWithHoldings` gain explicit fields so cash is never
miscounted as a gain:

| field | meaning |
|---|---|
| `holdings` | securities (unchanged) |
| `securitiesValue: number \| null` | Σ market value (today's `totalValue`) |
| `totalCost: number` | Σ securities cost basis (**unchanged meaning**) |
| `cash: number` | cash balance (may be negative) |
| `totalValue: number \| null` | `securitiesValue + cash` (**new headline**) |

`securitiesValue` is `null` if any quote fetch fails (today's behavior); `totalValue`
is then `null` too. Securities gain/loss = `securitiesValue − totalCost`.

## Analysis payload

`analysisService` adds `cash` and `securitiesValue` to the payload; `totals` becomes
`{ cost, securitiesValue, cash, totalValue }`. The transactions list includes the new
types (with `amount`). One sentence is added to `SYSTEM_PROMPT` instructing the model
to treat cash as a position (dry powder / allocation) and to account for deposits,
withdrawals, and dividend income.

## Performance-over-time chart

Because cash entries are dated, the chart becomes accurate. At each date:

```
value(date) = (forward-filled priced securities at date) + computeCashBalance(txs, date)
```

`calculateHoldingsAtDate` is filtered to `buy|sell`. The point-inclusion rule changes
from "has a priced holding or no holdings" to **"the portfolio has any transaction
dated on/before this date"**, so funded and cash-only portfolios plot correctly.

## API

- `POST /portfolios/:id/transactions` — branch validation by `type`:
  trades require `ticker` + positive `shares`/`price`; cash entries require positive
  `amount`; `dividend` allows an optional `ticker`. `date` required for all.
- `addTransaction(portfolioId, input)` is refactored to take a typed input object
  instead of fixed positional trade args.
- `GET /portfolios/:id` already spreads enriched output, so `cash` / `securitiesValue`
  flow through automatically.
- `DELETE /transactions/:id` unchanged; share re-validation filters to trades.

## Shared types

- `Transaction`: widen `type`; `ticker`/`shares`/`price` become `… | null`; add
  `amount: number | null`.
- `CreateTransactionRequest`: widen `type`; `ticker`/`shares`/`price` optional; add
  `amount?`.
- `PortfolioWithHoldings`: add `cash: number` and `securitiesValue: number | null`
  (`totalValue` now includes cash).

## Frontend

- **`TransactionForm`**: a type selector drives which inputs show — `buy`/`sell` →
  ticker/shares/price; `deposit`/`withdrawal` → amount; `dividend` → amount + optional
  ticker. Date always shown. Per-type validation and reset.
- **`TransactionTable`**: tolerate null `ticker`/`shares`/`price`; render a signed
  cash-effect in the "Total" column for every row (trades `∓shares×price`, cash
  `±amount`); extend the type badge colors to the new types.
- **`HoldingsSummary`**: props become `{ holdings, securitiesValue, cash, totalCost,
  totalValue }`. Headline = `totalValue` (incl. cash); gain/loss line =
  `securitiesValue − totalCost`. Append a styled **Cash row** (ticker "Cash";
  shares/avg/price/gain-loss shown as "—"; value = `cash`; allocation % =
  `cash / totalValue`). Render the card when `holdings.length > 0 || cash !== 0`.
  Allocation % for securities now divides by `totalValue` (cash-inclusive).
- **`PortfolioDetail`**: pass the new props through.

## Testing (Vitest)

- Add `vitest` dev dependency and a `test` script (`vitest run`).
- Unit tests for the pure functions (no DB needed):
  - `cashDelta` — each of the five types.
  - `computeCashBalance` — running sum, `asOf` filtering, negative balances.
  - `computeHoldings` — ignores cash entries; existing buy/sell behavior intact.
  - performance valuation — a pure `portfolioValueAtDate(txs, pricesAtDate, date)`
    helper combining priced securities + cash, asserted across dates incl. deposits.
- Extract the performance per-date valuation into a pure helper so it is testable
  with an injected price map.

## Out of scope (YAGNI)

Fees/commissions, multi-currency, automatic dividend detection or DRIP automation,
enforced funding/margin limits, and editing existing transactions (add/delete only,
as today).

## File change list

- `server/src/db.ts` — new schema + transactions table-rebuild migration.
- `server/src/services/transactionService.ts` — pure helpers (`cashDelta`,
  `computeCashBalance`, `computeHoldings`), `getCashBalance`, type-aware
  `addTransaction`, filtered validation.
- `server/src/services/holdingsEnrichment.ts` — `cash`, `securitiesValue`,
  cash-inclusive `totalValue`.
- `server/src/services/performanceService.ts` — cash in per-date value; pure
  valuation helper; inclusion rule.
- `server/src/services/analysisService.ts` — payload + system-prompt cash awareness.
- `server/src/routes/transactions.ts` — per-type validation.
- `shared/types.ts` — widened transaction/portfolio types.
- `src/components/TransactionForm.tsx` — type-driven fields.
- `src/components/TransactionTable.tsx` — render cash rows.
- `src/components/HoldingsSummary.tsx` — cash row + headline/P/L split.
- `src/components/PortfolioDetail.tsx` — pass new props.
- test files + `package.json` (vitest), config as needed.
