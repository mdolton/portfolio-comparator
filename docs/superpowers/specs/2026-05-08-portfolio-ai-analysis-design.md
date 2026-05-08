# Portfolio AI Analysis — Design

**Date:** 2026-05-08
**Status:** Approved

## Summary

Add an AI-generated analysis to each portfolio's detail page. The user clicks
**Generate Analysis** to produce an expert opinion grounded in the portfolio's
holdings, transaction history, and notes (which often contain the user's
thesis). The analysis is persisted server-side and shown on subsequent page
loads. Regenerating replaces the previous analysis.

## Goals

- One-click portfolio analysis using Claude.
- Persistent: the most recent analysis is shown until the user regenerates.
- Grounded in the portfolio's actual data plus the user's thesis from notes.
- Structured, scannable output (Overview / Strengths / Risks / Suggestions).

## Non-goals

- No analysis history (only the latest is retained).
- No streaming output. The button blocks with a spinner.
- No automatic regeneration on data changes.
- No comparison across portfolios.
- No financial-advice disclaimers beyond a brief inline note.

## Architecture

A new "analysis" slice runs alongside the existing portfolio slice, following
the project's `routes → services → db` pattern.

- **Backend:** new `portfolio_analyses` table, `analysisService.ts`, analysis
  endpoints mounted under the existing portfolios router, `@anthropic-ai/sdk`
  call.
- **Frontend:** new `AnalysisPanel` component on the portfolio detail page,
  `usePortfolioAnalysis` hook, `react-markdown` for rendering.
- **Shared:** add `PortfolioAnalysis` type.

## Data model

New SQLite table:

```sql
CREATE TABLE IF NOT EXISTS portfolio_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id INTEGER NOT NULL UNIQUE,
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);
```

`UNIQUE(portfolio_id)` enforces one analysis per portfolio. Generation upserts
via `INSERT … ON CONFLICT(portfolio_id) DO UPDATE SET content = excluded.content,
model = excluded.model, generated_at = datetime('now')`.

The schema is added to the existing `db.exec()` block in `server/src/db.ts`
alongside the existing tables — same pattern, no migration tool needed.

## Shared type

Added to `shared/types.ts`:

```ts
export interface PortfolioAnalysis {
  id: number;
  portfolio_id: number;
  content: string;
  model: string;
  generated_at: string;
}
```

## API

Two endpoints, added to the existing portfolios router in
`server/src/routes/portfolios.ts` (the routes are nested under
`/api/portfolios/:id` so they belong there):

- `GET /api/portfolios/:id/analysis` → `PortfolioAnalysis | null`
  - Returns the latest analysis for the portfolio, or `null` if none exists.
  - 404 if the portfolio itself does not exist.

- `POST /api/portfolios/:id/analysis` → `PortfolioAnalysis`
  - Builds the prompt, calls Claude, upserts the row, returns the new analysis.
  - 404 if the portfolio does not exist.
  - 500 if `ANTHROPIC_API_KEY` is missing on the server.
  - 502 if the Claude API call fails. The existing analysis is **not** modified
    on failure — the upsert only runs after a successful API response.

## Service layer

New `server/src/services/analysisService.ts` exposes:

- `getAnalysis(portfolioId: number): PortfolioAnalysis | null`
- `generateAnalysis(portfolioId: number): Promise<PortfolioAnalysis>`

`generateAnalysis` is responsible for:

1. Loading portfolio + notes (via `portfolioService`).
2. Loading holdings enriched with current prices (reusing the same enrichment
   logic as `GET /api/portfolios/:id` — extract that enrichment into a shared
   helper in `portfolioService` or `transactionService` so both call sites use
   the same code).
3. Loading the full transaction list (via `transactionService`).
4. Building the prompt payload.
5. Calling Claude via `@anthropic-ai/sdk`.
6. Upserting the `portfolio_analyses` row and returning it.

## Prompt design

**Model:** `claude-sonnet-4-6` (claude-sonnet-4-6). Stored in the
`portfolio_analyses.model` column so we can tell when older analyses came from
a different model.

**System prompt** (concise, in the service):

> You are an experienced portfolio analyst. Given a user's portfolio data and
> their notes (which may contain their investment thesis), produce a clear,
> grounded analysis. Take the user's stated thesis seriously and reference it
> explicitly. Be concrete: name specific holdings when discussing strengths,
> risks, or suggestions. Reason about position sizing, concentration, recent
> transaction activity, and how the holdings align with the stated thesis.
>
> Return **markdown** with exactly these sections in this order:
>
> ```
> ## Overview
> ## Strengths
> ## Risks
> ## Suggestions
> ```
>
> End with a single italic line: *This is informational analysis, not financial
> advice.*

**User prompt** is a JSON-shaped block containing:

```json
{
  "notes": "<portfolio.notes>",
  "totals": { "cost": 12345.67, "value": 13900.00 },
  "holdings": [
    {
      "ticker": "AAPL",
      "shares": 10,
      "avgCost": 150.00,
      "totalCost": 1500.00,
      "currentPrice": 180.00,
      "marketValue": 1800.00,
      "gainLoss": 300.00,
      "gainLossPercent": 20.0
    }
  ],
  "transactions": [
    { "ticker": "AAPL", "type": "buy", "shares": 10, "price": 150.00, "date": "2025-01-15" }
  ]
}
```

If `notes` is empty, the prompt explicitly tells Claude there is no stated
thesis and to ground the analysis in the holdings and transaction patterns
alone.

If `holdings` is empty, the prompt tells Claude the portfolio is empty and to
return a brief Overview noting that, with empty Strengths / Risks / Suggestions
sections (each containing a single bullet that explains the portfolio is empty
and to add transactions first).

**Generation parameters:** `max_tokens: 2000`, default temperature.

## Frontend

### Component placement

`AnalysisPanel` is rendered in `PortfolioDetail.tsx` **between the notes
textarea and `HoldingsSummary`**.

### Component behavior

- **Empty state** (no analysis yet): heading + short helper text + **Generate
  Analysis** button.
- **Populated state**: rendered markdown, a small `Generated <relative date>`
  caption, and a **Regenerate Analysis** button.
- **Generating**: button shows spinner and is disabled. Other UI remains
  interactive.
- **Regenerate flow**: clicking *Regenerate* opens a `window.confirm` with
  text like "Replace the existing analysis? The previous one cannot be
  recovered." Only proceeds on confirm.
- **Error**: surface inline below the button (red text, same style as existing
  `error-message` class). The previous analysis (if any) remains visible.

### Hook

`src/hooks/usePortfolioAnalysis.ts` exposes:

```ts
{
  analysis: PortfolioAnalysis | null;
  loading: boolean;          // initial GET
  generating: boolean;       // POST in flight
  error: string | null;
  generate: () => Promise<void>;
}
```

Uses the existing `api.get` / `api.post` from `src/api/client.ts`.

### Markdown rendering

New client dep: `react-markdown`. No remark/rehype plugins needed — the
prescribed sections are plain markdown headings and bullets.

The rendered markdown is wrapped in a container with the project's existing
`card` styling so it matches the rest of the page.

## Configuration

- New env var: `ANTHROPIC_API_KEY`. Read in `analysisService.ts` (or a small
  config module). If unset when `generateAnalysis` is called, throw
  `AppError(500, 'ANTHROPIC_API_KEY not configured on server')`.
- Documented in `README.md` and `docker-compose.prod.yml` as a required env var
  for the analysis feature. Without it, the rest of the app continues to work;
  only generation fails.

## Dependencies

- **Server:** `@anthropic-ai/sdk` (latest).
- **Client:** `react-markdown` (latest stable; no plugins).

## Error handling

| Scenario | Behavior |
|---|---|
| Portfolio not found | 404 from both endpoints. |
| `ANTHROPIC_API_KEY` missing | 500 with clear message; UI surfaces it inline. |
| Claude API failure (network, rate limit, 5xx) | 502; existing analysis preserved; UI surfaces error. |
| Empty portfolio (no holdings) | Generation still succeeds; prompt tells Claude. |
| Empty notes | Generation still succeeds; prompt tells Claude. |

## Verification

The project has no test harness, so verification is manual + the existing
checks:

- `npm run build` — type-check passes (front and back via the existing tsc
  build).
- `npm run lint` — no new lint errors.
- Manual: empty portfolio → generate; populated portfolio with notes →
  generate; regenerate confirm dialog appears and replaces content; missing
  `ANTHROPIC_API_KEY` → error surfaces inline; deleting a portfolio cascades
  the analysis row away.

## Out of scope (deferred)

- Streaming output via SSE.
- Analysis history / version log.
- Cross-portfolio comparison.
- Per-holding deep-dive analyses.
- Caching/rate-limiting on the generate endpoint (single-user local app).
