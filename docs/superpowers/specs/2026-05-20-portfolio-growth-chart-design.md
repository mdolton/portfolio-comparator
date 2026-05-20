# Time-Weighted Growth View for the Dashboard Chart

**Date:** 2026-05-20
**Status:** Approved (design)

## Problem

The dashboard's "Performance Comparison" chart plots **total portfolio value** over
time, where value at each date = priced securities + cash balance. Because the cash
balance includes deposits, a cash deposit makes the line jump up by the deposited
amount — which reads as "growth" even though nothing was earned. We want the chart to
show the **real growth** of each portfolio, neutralizing the size and timing of cash
deposits and withdrawals.

## Goal

Add a time-weighted return (TWR) view to the dashboard chart, selectable via a toggle,
so deposits/withdrawals never register as growth while genuine investment gains
(including dividends) do.

## Decisions

| Decision | Choice |
| --- | --- |
| Growth metric | Time-weighted return (TWR), shown as cumulative % |
| Baseline | Resets to 0% at the start of the selected date range (window return) |
| View mode | `Value / Growth %` toggle above the chart; both views kept |
| Default view | Growth % |
| Compute location | Backend, reusing the existing daily-value loop |
| Testing | Add Vitest; unit-test the pure math functions |

## The Math

TWR chains daily growth factors, dividing out external cash flows so that
deposits/withdrawals never count as growth:

```
externalFlow(d)   = deposits(d) − withdrawals(d)          // dividends EXCLUDED
returnFactor(d)   = (V(d) − externalFlow(d)) / V(d−1)     // for V(d−1) > 0
index(d)          = index(d−1) × returnFactor(d),  index(baseline) = 1
growth%(d)        = (index(d) − 1) × 100
```

where `V(d)` is the existing total portfolio value at date `d` (priced securities +
cash balance).

### Transaction classification

- **Deposits / withdrawals** → external flows, divided out. They never count as growth.
  This is the core fix.
- **Dividends** → treated as investment *return* (internal income), so they DO count as
  growth. Standard TWR treatment. Mechanically: a dividend raises cash (and thus `V(d)`)
  but is **not** included in `externalFlow(d)`, so it flows through `returnFactor`.
- **Buys / sells** → internal cash↔shares swaps, value-neutral at trade time, so they do
  not affect the line and are not external flows.

### Baseline & edge guards

- **Baseline** = the first date with positive value (`V > 0`) at or after the selected
  range start. That date's `growth% = 0`. No growth points are emitted before the
  baseline date.
- **Empty-then-refund:** when `V(d−1) ≤ 0` (e.g. a withdrawal emptied the account, then a
  later deposit re-funds it), that day's `returnFactor = 1` (flat) and the index base
  re-establishes from the new value. This avoids divide-by-zero and avoids fabricating a
  return when there was no invested base.

## Architecture

### Backend

Reuse the existing per-date loop in `performanceService.getPerformanceData`. The loop
already computes `V(d)` per portfolio per date; extend it to also accumulate
`externalFlow(d)` per portfolio in the same pass, then derive the growth series from the
two arrays.

New pure functions in `server/src/services/portfolioMath.ts` (matching the existing
pattern where all portfolio math is isolated and testable):

- `externalCashFlow(tx)` — returns the external cash flow of a single transaction:
  `+amount` for `deposit`, `−amount` for `withdrawal`, `0` for everything else
  (dividends, buys, sells). Sibling to the existing `cashDelta`.
- `timeWeightedReturnSeries(points)` — takes an ordered array of
  `{ date: string; value: number; flow: number }` and returns
  `{ date: string; growthPct: number }[]`, applying the baseline rule and the
  `V(d−1) ≤ 0` edge guard above. Days before the baseline are omitted from the output.

### API shape

The `/api/performance` response changes from a bare array to both series in one payload,
so the toggle is instant (no refetch). `/performance` is consumed only by the dashboard
chart (`usePerformance` → `DashboardPage` → `PerformanceChart`); nothing else depends on
its shape, so this change is safe.

```ts
// shared/types.ts
interface PerformanceResponse {
  value:  PerformancePoint[];   // dollars (unchanged from today)
  growth: PerformancePoint[];   // cumulative % per portfolio
}
```

`PerformancePoint` is unchanged (`{ date, [portfolioName]: number }`); the growth series
reuses it with percent values keyed by portfolio name.

Computing both server-side costs nothing extra: prices are already fetched and cached,
and the growth series is derived from the same loop that builds the value series.

#### Alternatives considered

- **`?metric=` query param that recomputes per toggle** — rejected: adds refetch latency
  on every toggle for no benefit, since both series are cheap to compute together.
- **Keep the bare-array response, compute TWR on the frontend** — rejected: the frontend
  would need per-day external-flow data it does not currently have.

## UI

A small segmented control above the chart in `DashboardPage`, styled to match the
existing inline-styled controls.

```
Performance Comparison
┌─────────────────────────────────────┐
│ [Select Portfolios]   [Start] [End]  │
└─────────────────────────────────────┘
        [ Value ] [ Growth % ]   ← new, defaults to Growth %
┌─────────────────────────────────────┐
│            chart                      │
└─────────────────────────────────────┘
```

- New state `metric: 'value' | 'growth'` in `DashboardPage`, defaulting to `'growth'`.
- `usePerformance` stores the full `{ value, growth }` response. `DashboardPage` passes
  the selected series plus `metric` into `PerformanceChart`.
- `PerformanceChart` switches its formatters by `metric`:
  - **value:** Y-axis `$…k`, tooltip `formatCurrency` (current behavior).
  - **growth:** Y-axis `+12%` / `−3%`, tooltip e.g. `+12.34%`.
  - Lines, colors, and legend are unchanged between modes.

## Testing

Add **Vitest** (minimal config; no test runner exists today). Unit-test the new pure
math functions in `portfolioMath.ts`:

- Flat market → 0% throughout.
- A deposit mid-range → no jump in the growth line.
- A dividend mid-range → counts as growth.
- A withdrawal mid-range → no drop attributable to the withdrawal.
- Empty-then-refund edge guard (`V(d−1) ≤ 0`) → flat factor, base re-establishes.
- Baseline at range start → first emitted point is 0%.

The existing `cashDelta`, `computeCashBalance`, and `holdingsAtDate` functions get cheap
coverage as a bonus.

## Out of scope

- Money-weighted return (IRR / dollar-weighted).
- "Growth of a fixed amount" indexed-dollar view.
- Changing how historical prices are fetched, cached, or forward-filled.
- Any change to the AI analysis payload.
