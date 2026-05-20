# Time-Weighted Growth Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a time-weighted return (TWR) "Growth %" view to the dashboard chart, toggleable with the existing dollar "Value" view, so cash deposits/withdrawals never register as growth.

**Architecture:** Two new pure functions in `portfolioMath.ts` compute external cash flows and a TWR series. `performanceService` reuses its existing per-date loop to build both the dollar value series and the growth series, returning both in one payload. The dashboard stores both series and a segmented toggle picks which to plot; `PerformanceChart` switches its axis/tooltip formatters by metric.

**Tech Stack:** TypeScript, Node/Express (server, run via tsx), React 19 + Recharts (frontend), Vitest (already configured for `server/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-05-20-portfolio-growth-chart-design.md`

**Verification commands used in this plan:**
- Math/unit tests: `npm test`
- Server typecheck (no build step exists; tsx does not typecheck): `npx tsc -p server/tsconfig.json --noEmit`
- Frontend typecheck + build: `npm run build`
- Lint: `npm run lint`

---

## File Structure

All files already exist; this plan only modifies them.

- `server/src/services/portfolioMath.ts` — add `externalCashFlow`, `timeWeightedReturnSeries`, and the `DailyValuePoint` / `GrowthPoint` types. Pure, no I/O.
- `server/src/services/portfolioMath.test.ts` — add tests for the two new functions.
- `shared/types.ts` — add the `PerformanceResponse` interface.
- `server/src/services/performanceService.ts` — accumulate per-date external flows, build the growth series, return `{ value, growth }`.
- `src/hooks/usePerformance.ts` — store the `{ value, growth }` response.
- `src/components/PerformanceChart.tsx` — add a `metric` prop; switch axis/tooltip formatters.
- `src/pages/DashboardPage.tsx` — add the `Value / Growth %` toggle (default Growth %) and pass the selected series + metric to the chart.

No route change is needed: `server/src/routes/performance.ts` does `res.json(data)` and passes through whatever the service returns.

---

## Task 1: `externalCashFlow` pure function

External cash flows are deposits (+) and withdrawals (−) only. Dividends, buys, and sells return 0 — dividends must count as return, and buys/sells are internal cash↔shares swaps.

**Files:**
- Modify/Test: `server/src/services/portfolioMath.test.ts`
- Modify: `server/src/services/portfolioMath.ts`

- [ ] **Step 1: Update the test file's import line**

In `server/src/services/portfolioMath.test.ts`, replace the existing import:

```ts
import { cashDelta, computeCashBalance, computeHoldings, negativeShareViolation, holdingsAtDate, portfolioValueAtDate } from './portfolioMath';
```

with (adds the two new functions; `timeWeightedReturnSeries` is used in Task 2):

```ts
import { cashDelta, computeCashBalance, computeHoldings, negativeShareViolation, holdingsAtDate, portfolioValueAtDate, externalCashFlow, timeWeightedReturnSeries } from './portfolioMath';
```

- [ ] **Step 2: Write the failing test**

Append to `server/src/services/portfolioMath.test.ts` (the `tx` helper already exists at the top of the file):

```ts
describe('externalCashFlow', () => {
  it('is the positive amount for a deposit', () => {
    expect(externalCashFlow(tx({ type: 'deposit', amount: 100 }))).toBe(100);
  });
  it('is the negative amount for a withdrawal', () => {
    expect(externalCashFlow(tx({ type: 'withdrawal', amount: 30 }))).toBe(-30);
  });
  it('is zero for a dividend (counts as return, not an external flow)', () => {
    expect(externalCashFlow(tx({ type: 'dividend', amount: 7 }))).toBe(0);
  });
  it('is zero for buys and sells (internal cash<->shares swaps)', () => {
    expect(externalCashFlow(tx({ type: 'buy', shares: 10, price: 5 }))).toBe(0);
    expect(externalCashFlow(tx({ type: 'sell', shares: 10, price: 5 }))).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `externalCashFlow` is not exported / not a function.

- [ ] **Step 4: Implement `externalCashFlow`**

In `server/src/services/portfolioMath.ts`, add this function directly below the existing `cashDelta` function:

```ts
/** External cash flow of a single transaction: deposits/withdrawals only.
 *  Dividends count as investment return (not external), and buys/sells are
 *  internal cash<->shares swaps, so all three return 0. */
export function externalCashFlow(
  tx: Pick<Transaction, 'type' | 'amount'>,
): number {
  switch (tx.type) {
    case 'deposit':
      return tx.amount ?? 0;
    case 'withdrawal':
      return -(tx.amount ?? 0);
    default:
      return 0;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all `externalCashFlow` tests green; the previously passing 15 tests still pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/portfolioMath.ts server/src/services/portfolioMath.test.ts
git commit -m "feat: add externalCashFlow for time-weighted return"
```

---

## Task 2: `timeWeightedReturnSeries` pure function

Chains daily growth factors, dividing out external flows. Baseline (0%) is the first day with positive value; days before it are omitted. When the prior day's value is ≤ 0 (account emptied then re-funded), the day is treated as flat to avoid divide-by-zero.

**Files:**
- Test: `server/src/services/portfolioMath.test.ts`
- Modify: `server/src/services/portfolioMath.ts`

- [ ] **Step 1: Write the failing tests**

Append to `server/src/services/portfolioMath.test.ts`:

```ts
describe('timeWeightedReturnSeries', () => {
  it('is flat at 0% when the market does not move', () => {
    const out = timeWeightedReturnSeries([
      { date: 'd1', value: 100, flow: 100 },
      { date: 'd2', value: 100, flow: 0 },
      { date: 'd3', value: 100, flow: 0 },
    ]);
    expect(out.map((p) => p.growthPct)).toEqual([0, 0, 0]);
  });

  it('does not jump when a deposit arrives', () => {
    const out = timeWeightedReturnSeries([
      { date: 'd1', value: 100, flow: 100 }, // baseline
      { date: 'd2', value: 110, flow: 0 },   // +10% market
      { date: 'd3', value: 210, flow: 100 }, // +100 deposit, no market move
      { date: 'd4', value: 231, flow: 0 },   // +10% on 210
    ]);
    expect(out[0].growthPct).toBeCloseTo(0);
    expect(out[1].growthPct).toBeCloseTo(10);
    expect(out[2].growthPct).toBeCloseTo(10); // deposit did not move the line
    expect(out[3].growthPct).toBeCloseTo(21);
  });

  it('counts a dividend as growth', () => {
    const out = timeWeightedReturnSeries([
      { date: 'd1', value: 100, flow: 100 },
      { date: 'd2', value: 105, flow: 0 }, // +5 dividend lands in value, flow=0
    ]);
    expect(out[1].growthPct).toBeCloseTo(5);
  });

  it('does not drop when a withdrawal is taken', () => {
    const out = timeWeightedReturnSeries([
      { date: 'd1', value: 100, flow: 100 },
      { date: 'd2', value: 50, flow: -50 }, // withdraw 50, no market move
      { date: 'd3', value: 55, flow: 0 },   // +10% on remaining 50
    ]);
    expect(out[1].growthPct).toBeCloseTo(0);
    expect(out[2].growthPct).toBeCloseTo(10);
  });

  it('handles emptying then re-funding the account without dividing by zero', () => {
    const out = timeWeightedReturnSeries([
      { date: 'd1', value: 100, flow: 100 },
      { date: 'd2', value: 0, flow: -100 }, // withdraw everything
      { date: 'd3', value: 50, flow: 50 },  // re-fund
      { date: 'd4', value: 60, flow: 0 },   // +20% on 50
    ]);
    expect(out.map((p) => p.growthPct)).toEqual([0, 0, 0, expect.closeTo(20)]);
  });

  it('starts the baseline at the first day with positive value', () => {
    const out = timeWeightedReturnSeries([
      { date: 'd1', value: 0, flow: 0 },     // no activity yet -> omitted
      { date: 'd2', value: 0, flow: 0 },     // omitted
      { date: 'd3', value: 200, flow: 200 }, // baseline 0%
      { date: 'd4', value: 220, flow: 0 },   // +10%
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ date: 'd3', growthPct: 0 });
    expect(out[1].date).toBe('d4');
    expect(out[1].growthPct).toBeCloseTo(10);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `timeWeightedReturnSeries` is not exported / not a function.

- [ ] **Step 3: Implement the types and function**

In `server/src/services/portfolioMath.ts`, add near the top of the file (just below the existing imports) the two interfaces:

```ts
/** One day of a portfolio's history: total value and the external cash flow
 *  (deposits − withdrawals) that occurred that day. */
export interface DailyValuePoint {
  date: string;
  value: number;
  flow: number;
}

/** Cumulative time-weighted return at a date, in percent. */
export interface GrowthPoint {
  date: string;
  growthPct: number;
}
```

Then add this function at the end of the file:

```ts
/** Cumulative time-weighted return (%) per date. Chains daily growth factors,
 *  dividing out external cash flows so deposits/withdrawals never count as
 *  growth. The baseline (0%) is the first day with positive value; earlier
 *  days are omitted. Days whose prior value is <= 0 are treated as flat to
 *  avoid divide-by-zero (e.g. account emptied then re-funded). */
export function timeWeightedReturnSeries(points: DailyValuePoint[]): GrowthPoint[] {
  const result: GrowthPoint[] = [];
  let index = 1; // cumulative TWR index; growth% = (index - 1) * 100
  let prevValue = 0; // value at the previous day, V(d-1)
  let started = false;

  for (const { date, value, flow } of points) {
    if (!started) {
      // Establish the baseline on the first day the portfolio holds value.
      if (value > 0) {
        started = true;
        prevValue = value;
        result.push({ date, growthPct: 0 });
      }
      continue;
    }

    // V(d-1) > 0: chain the day's growth factor, removing the external flow.
    // V(d-1) <= 0: no invested base, so treat the day as flat (factor = 1).
    if (prevValue > 0) {
      index *= (value - flow) / prevValue;
    }

    result.push({ date, growthPct: (index - 1) * 100 });
    prevValue = value;
  }

  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all `timeWeightedReturnSeries` tests green; everything from Task 1 and the original 15 tests still pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/portfolioMath.ts server/src/services/portfolioMath.test.ts
git commit -m "feat: add timeWeightedReturnSeries to portfolio math"
```

---

## Task 3: `PerformanceResponse` type + dual-series performance service

`performanceService` now returns both the dollar value series (unchanged) and the growth series, derived from per-portfolio daily value+flow arrays built in the same loop.

**Files:**
- Modify: `shared/types.ts`
- Modify: `server/src/services/performanceService.ts`

- [ ] **Step 1: Add the `PerformanceResponse` type**

In `shared/types.ts`, directly below the existing `PerformancePoint` interface, add:

```ts
export interface PerformanceResponse {
  value: PerformancePoint[];  // total portfolio value in dollars
  growth: PerformancePoint[]; // cumulative time-weighted return in percent
}
```

- [ ] **Step 2: Replace the performance service with the dual-series version**

Replace the entire contents of `server/src/services/performanceService.ts` with:

```ts
import * as transactionService from './transactionService.js';
import * as portfolioService from './portfolioService.js';
import * as marketService from './marketService.js';
import type { PerformancePoint, PerformanceResponse } from '../../../shared/types.js';
import {
  portfolioValueAtDate,
  externalCashFlow,
  timeWeightedReturnSeries,
  type DailyValuePoint,
} from './portfolioMath.js';

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/** Merge per-portfolio TWR series into date-keyed PerformancePoints. */
function buildGrowthPoints(
  dailyByPortfolio: Map<string, DailyValuePoint[]>,
): PerformancePoint[] {
  const byDate = new Map<string, PerformancePoint>();

  for (const [name, daily] of dailyByPortfolio) {
    for (const { date, growthPct } of timeWeightedReturnSeries(daily)) {
      const point = byDate.get(date) ?? { date };
      point[name] = Math.round(growthPct * 100) / 100;
      byDate.set(date, point);
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getPerformanceData(
  portfolioIds: number[],
  startDate: string,
  endDate: string,
): Promise<PerformanceResponse> {
  // Gather all transactions and portfolio info
  const portfolioData = portfolioIds.map((id) => {
    const portfolio = portfolioService.getPortfolioById(id);
    const transactions = transactionService.getTransactionsByPortfolio(id);
    return { portfolio: portfolio!, transactions };
  });

  // Collect all unique tickers across all portfolios
  const allTickers = new Set<string>();
  for (const { transactions } of portfolioData) {
    for (const tx of transactions) {
      if ((tx.type === 'buy' || tx.type === 'sell') && tx.ticker) {
        allTickers.add(tx.ticker);
      }
    }
  }

  // Fetch historical prices for all tickers
  const pricesByTicker = new Map<string, Map<string, number>>();
  await Promise.all(
    Array.from(allTickers).map(async (ticker) => {
      const prices = await marketService.getHistoricalPrices(ticker, startDate, endDate);
      pricesByTicker.set(ticker, prices);
    }),
  );

  // Generate all dates in range
  const dates = generateDateRange(startDate, endDate);

  // Forward-fill prices: for each ticker, track last known price
  const lastKnownPrice = new Map<string, number>();

  const valueResult: PerformancePoint[] = [];

  // Per-portfolio daily value+flow arrays feed the growth (TWR) series.
  const dailyByPortfolio = new Map<string, DailyValuePoint[]>();
  for (const { portfolio } of portfolioData) {
    if (portfolio) dailyByPortfolio.set(portfolio.name, []);
  }

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

      const value = portfolioValueAtDate(transactions, lastKnownPrice, date);
      const flow = transactions.reduce(
        (sum, t) => (t.date === date ? sum + externalCashFlow(t) : sum),
        0,
      );
      dailyByPortfolio.get(portfolio.name)!.push({ date, value, flow });

      // Value series: only plot once the portfolio has any activity by this date.
      if (transactions.some((t) => t.date <= date)) {
        point[portfolio.name] = Math.round(value * 100) / 100;
      }
    }

    const portfolioKeys = Object.keys(point).filter((k) => k !== 'date');
    if (portfolioKeys.length > 0) {
      valueResult.push(point);
    }
  }

  return { value: valueResult, growth: buildGrowthPoints(dailyByPortfolio) };
}
```

- [ ] **Step 3: Typecheck the server**

Run: `npx tsc -p server/tsconfig.json --noEmit`
Expected: no output (exit 0). No type errors.

- [ ] **Step 4: Confirm the math tests still pass**

Run: `npm test`
Expected: PASS — unchanged from Task 2 (this task added no tests; it relies on the Task 1–2 coverage of the math plus the typecheck above).

- [ ] **Step 5: Commit**

```bash
git add shared/types.ts server/src/services/performanceService.ts
git commit -m "feat: return both value and growth series from performance API"
```

---

## Task 4: Frontend — toggle between Value and Growth %

The hook stores both series; `DashboardPage` adds a segmented toggle (default Growth %) and passes the selected series + metric to the chart, which switches its formatters. These three files are interdependent, so they are verified together with `npm run build` + `npm run lint` at the end.

**Files:**
- Modify: `src/hooks/usePerformance.ts`
- Modify: `src/components/PerformanceChart.tsx`
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Update the hook to store both series**

Replace the entire contents of `src/hooks/usePerformance.ts` with:

```ts
import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { PerformanceResponse } from '@shared/types';

const EMPTY: PerformanceResponse = { value: [], growth: [] };

export function usePerformance() {
  const [data, setData] = useState<PerformanceResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(
    async (portfolioIds: number[], startDate: string, endDate: string) => {
      if (portfolioIds.length === 0) {
        setData(EMPTY);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const ids = portfolioIds.join(',');
        const result = await api.get<PerformanceResponse>(
          `/performance?ids=${ids}&start=${startDate}&end=${endDate}`,
        );
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch performance data');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { data, loading, error, fetchPerformance };
}
```

- [ ] **Step 2: Add the `metric` prop to the chart and switch formatters**

In `src/components/PerformanceChart.tsx`:

(a) Update the formatting import to include `formatPercent`:

```ts
import { formatCurrency, formatPercent } from '../utils/formatting';
```

(b) Add `metric` to the `Props` interface:

```ts
interface Props {
  data: PerformancePoint[];
  portfolios: Portfolio[];
  selectedIds: number[];
  loading: boolean;
  metric: 'value' | 'growth';
}
```

(c) Update the function signature to destructure `metric`:

```ts
export function PerformanceChart({ data, portfolios, selectedIds, loading, metric }: Props) {
```

(d) Replace the `<YAxis ... />` element with one that formats by metric:

```tsx
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) =>
            metric === 'growth'
              ? `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`
              : `$${(v / 1000).toFixed(0)}k`
          }
        />
```

(e) Replace the `<Tooltip ... />` `formatter` prop so values render by metric (leave `labelFormatter` unchanged):

```tsx
          formatter={(value: number, name: string) => [
            metric === 'growth' ? formatPercent(value) : formatCurrency(value),
            name,
          ]}
```

- [ ] **Step 3: Add the toggle to the dashboard and pass the selected series**

In `src/pages/DashboardPage.tsx`:

(a) Add a `metric` state alongside the existing `useState` calls (just after the `dateRange` state):

```ts
  const [metric, setMetric] = useState<'value' | 'growth'>('growth');
```

(b) Replace the chart card block:

```tsx
      <div className="card">
        <PerformanceChart
          data={data}
          portfolios={portfolios}
          selectedIds={selectedIds}
          loading={perfLoading}
        />
      </div>
```

with a version that renders the toggle and passes the selected series + metric:

```tsx
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <div
            style={{
              display: 'inline-flex',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
            }}
          >
            {(['value', 'growth'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: metric === m ? 'var(--primary)' : 'transparent',
                  color: metric === m ? '#fff' : 'var(--text-muted)',
                }}
              >
                {m === 'value' ? 'Value' : 'Growth %'}
              </button>
            ))}
          </div>
        </div>
        <PerformanceChart
          data={data[metric]}
          metric={metric}
          portfolios={portfolios}
          selectedIds={selectedIds}
          loading={perfLoading}
        />
      </div>
```

- [ ] **Step 4: Typecheck + build the frontend**

Run: `npm run build`
Expected: PASS — `tsc -b` reports no errors and `vite build` completes. (If it fails with "data is of type PerformanceResponse / not assignable to PerformancePoint[]", confirm Step 3(b) passes `data[metric]`, not `data`.)

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: PASS — no new lint errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open the dashboard, select a portfolio that has at least one `deposit` plus some buys.
- Confirm the toggle defaults to **Growth %** and the Y-axis shows percentages.
- Confirm a deposit does **not** produce a vertical jump in the Growth % line.
- Click **Value** and confirm the original dollar line returns (deposit causes the expected jump), with the `$…k` Y-axis.
- Confirm switching the toggle is instant (no network refetch / loading flash).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/usePerformance.ts src/components/PerformanceChart.tsx src/pages/DashboardPage.tsx
git commit -m "feat: add Value / Growth % toggle to dashboard chart"
```

---

## Self-Review

**Spec coverage:**
- Metric = TWR % → Task 2 (`timeWeightedReturnSeries`).
- Baseline resets at range start → Task 2 baseline logic (first positive value in the range-bounded series) + Task 3 builds each portfolio's daily array over the selected range only.
- Deposits/withdrawals excluded, dividends counted, buys/sells neutral → Task 1 (`externalCashFlow`) + its tests.
- Empty-then-refund edge guard → Task 2 (`prevValue > 0` check) + its test.
- API returns `{ value, growth }` → Task 3 (`PerformanceResponse`, service return).
- Toggle, default Growth %, formatter switch → Task 4.
- Vitest tests for the math → Tasks 1 and 2.

**Placeholder scan:** none — every step has concrete code/commands and expected output.

**Type consistency:** `DailyValuePoint { date, value, flow }` and `GrowthPoint { date, growthPct }` (Task 2) are consumed unchanged by `buildGrowthPoints`/`getPerformanceData` (Task 3) and the `timeWeightedReturnSeries` tests (Task 2). `PerformanceResponse { value, growth }` (Task 3) matches the hook's `api.get<PerformanceResponse>` and `data[metric]` access (Task 4). `metric: 'value' | 'growth'` is identical across `DashboardPage` and `PerformanceChart` (Task 4). `externalCashFlow(Pick<Transaction,'type'|'amount'>)` matches its call in the service's `reduce` (passes a full `Transaction`).
