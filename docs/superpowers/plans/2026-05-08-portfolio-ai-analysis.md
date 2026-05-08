# Portfolio AI Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Generate Analysis" button to the portfolio detail page that produces a Claude-generated, persisted, markdown analysis of the portfolio (holdings + transactions + notes), shown until the user regenerates.

**Architecture:** New `portfolio_analyses` SQLite table holds one analysis per portfolio (upserted on regenerate). A new `analysisService` builds a structured prompt and calls Claude via `@anthropic-ai/sdk`. Two new routes (`GET`/`POST /api/portfolios/:id/analysis`) live alongside the existing portfolio routes. On the client, `AnalysisPanel` (rendered between notes and `HoldingsSummary`) uses a `usePortfolioAnalysis` hook and `react-markdown` to render the result.

**Tech Stack:** TypeScript, Express 5, better-sqlite3, React 19, `@anthropic-ai/sdk`, `react-markdown`, Vite.

**Spec:** `docs/superpowers/specs/2026-05-08-portfolio-ai-analysis-design.md`

**Note on testing:** This project has no test harness. Verification for each task uses TypeScript build (`npm run build`), ESLint (`npm run lint`), and targeted manual checks (curl for endpoints, browser for UI). Adding a test harness is out of scope.

---

## File Structure

**New files:**
- `server/src/services/analysisService.ts` — prompt building, Claude call, upsert.
- `server/src/services/holdingsEnrichment.ts` — shared helper that takes a portfolio id, returns holdings enriched with current prices + a totalValue (extracted from `routes/portfolios.ts`).
- `src/components/AnalysisPanel.tsx` — UI component for the portfolio detail page.
- `src/hooks/usePortfolioAnalysis.ts` — fetch + generate hook.

**Modified files:**
- `shared/types.ts` — add `PortfolioAnalysis` interface.
- `server/src/db.ts` — add `portfolio_analyses` table to the existing `db.exec` block.
- `server/src/routes/portfolios.ts` — use the new enrichment helper; add `GET` and `POST` analysis routes.
- `server/package.json` — add `@anthropic-ai/sdk`.
- `package.json` — add `react-markdown`.
- `src/components/PortfolioDetail.tsx` — render `AnalysisPanel` between notes and `HoldingsSummary`.
- `README.md` — document `ANTHROPIC_API_KEY` env var and the new endpoints.
- `docker-compose.prod.yml` — pass through `ANTHROPIC_API_KEY`.

---

## Task 1: Add `PortfolioAnalysis` shared type

**Files:**
- Modify: `shared/types.ts`

- [ ] **Step 1: Append the `PortfolioAnalysis` interface to `shared/types.ts`**

Append at the end of the file:

```ts
export interface PortfolioAnalysis {
  id: number;
  portfolio_id: number;
  content: string;
  model: string;
  generated_at: string;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS, no errors.

- [ ] **Step 3: Commit**

```bash
git add shared/types.ts
git commit -m "Add PortfolioAnalysis shared type"
```

---

## Task 2: Add `portfolio_analyses` table to the schema

**Files:**
- Modify: `server/src/db.ts`

- [ ] **Step 1: Add the table to the `db.exec` block**

In `server/src/db.ts`, inside the existing `db.exec(\`...\`)` template literal, after the `price_cache` table definition (before the closing backtick), add:

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

- [ ] **Step 2: Start the server and confirm the table is created**

Run: `npm run dev --prefix server` (in a separate terminal, or `run_in_background`).
Then in another shell:

```bash
sqlite3 server/data/portfolio.db ".schema portfolio_analyses"
```

Expected: prints the `CREATE TABLE portfolio_analyses (...)` statement.

Stop the server.

- [ ] **Step 3: Commit**

```bash
git add server/src/db.ts
git commit -m "Add portfolio_analyses table"
```

---

## Task 3: Install `@anthropic-ai/sdk` on the server

**Files:**
- Modify: `server/package.json`, `server/package-lock.json`

- [ ] **Step 1: Install the SDK**

Run:

```bash
npm install --prefix server @anthropic-ai/sdk
```

Expected: install succeeds; `@anthropic-ai/sdk` appears in `server/package.json` `dependencies`.

- [ ] **Step 2: Verify the import works**

Run:

```bash
node --input-type=module -e "import('@anthropic-ai/sdk').then(m => console.log(typeof m.default))" --experimental-vm-modules 2>/dev/null || (cd server && node --input-type=module -e "import('@anthropic-ai/sdk').then(m => console.log(typeof m.default))")
```

Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "Install @anthropic-ai/sdk on server"
```

---

## Task 4: Extract holdings enrichment into a shared helper

This is a pure refactor: move the per-holding price enrichment from `routes/portfolios.ts` into `services/holdingsEnrichment.ts` so the analysis service can reuse it. Behavior of `GET /api/portfolios/:id` must not change.

**Files:**
- Create: `server/src/services/holdingsEnrichment.ts`
- Modify: `server/src/routes/portfolios.ts`

- [ ] **Step 1: Create `holdingsEnrichment.ts`**

Create `server/src/services/holdingsEnrichment.ts` with:

```ts
import * as transactionService from './transactionService.js';
import * as marketService from './marketService.js';
import type { Holding } from '../../../shared/types.js';

export interface EnrichedHoldings {
  holdings: Holding[];
  totalValue: number | null;
  totalCost: number;
}

export async function getEnrichedHoldings(portfolioId: number): Promise<EnrichedHoldings> {
  const holdings = transactionService.getHoldings(portfolioId);

  let totalValue: number | null = 0;
  for (const holding of holdings) {
    try {
      const quote = await marketService.getQuote(holding.ticker);
      holding.currentPrice = quote.price;
      holding.marketValue = holding.shares * quote.price;
      holding.gainLoss = holding.marketValue - holding.totalCost;
      holding.gainLossPercent =
        holding.totalCost > 0 ? (holding.gainLoss / holding.totalCost) * 100 : null;
      if (totalValue !== null) totalValue += holding.marketValue;
    } catch {
      totalValue = null;
    }
  }

  return {
    holdings,
    totalValue,
    totalCost: holdings.reduce((sum, h) => sum + h.totalCost, 0),
  };
}
```

- [ ] **Step 2: Replace the inline enrichment in `routes/portfolios.ts`**

In `server/src/routes/portfolios.ts`, replace the `GET /:id` handler body (the entire async block for the route) so that the file's imports and the route look like this. Keep the rest of the file unchanged.

Add to the imports at the top (alongside the existing imports):

```ts
import * as holdingsEnrichment from '../services/holdingsEnrichment.js';
```

Remove the now-unused `transactionService` and `marketService` imports **only if no other handler in the file still uses them**. (Currently the only user of those two in this file is the `GET /:id` handler; verify before deleting. If they're still referenced elsewhere in the file after this task, leave the imports alone.)

Replace the existing `router.get('/:id', async (req, res) => { ... })` block with:

```ts
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const portfolio = portfolioService.getPortfolioById(id);
  if (!portfolio) throw new AppError(404, 'Portfolio not found');

  const enriched = await holdingsEnrichment.getEnrichedHoldings(id);

  res.json({
    ...portfolio,
    ...enriched,
  });
});
```

- [ ] **Step 3: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: both PASS, no errors.

- [ ] **Step 4: Manual sanity — `GET /api/portfolios/:id` still works**

Start the server (`npm run dev --prefix server`), then:

```bash
curl -s http://localhost:3001/api/portfolios | head -c 500
# pick an id from the list, e.g. 1
curl -s http://localhost:3001/api/portfolios/1 | head -c 1000
```

Expected: response includes `holdings`, `totalValue`, `totalCost` — same shape as before.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/holdingsEnrichment.ts server/src/routes/portfolios.ts
git commit -m "Extract holdings enrichment into shared service"
```

---

## Task 5: Implement `analysisService`

**Files:**
- Create: `server/src/services/analysisService.ts`

- [ ] **Step 1: Create `analysisService.ts`**

Create `server/src/services/analysisService.ts` with the following content:

```ts
import Anthropic from '@anthropic-ai/sdk';
import db from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import * as portfolioService from './portfolioService.js';
import * as transactionService from './transactionService.js';
import * as holdingsEnrichment from './holdingsEnrichment.js';
import type { PortfolioAnalysis } from '../../../shared/types.js';

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are an experienced portfolio analyst. Given a user's portfolio data and their notes (which may contain their investment thesis), produce a clear, grounded analysis. Take the user's stated thesis seriously and reference it explicitly. Be concrete: name specific holdings when discussing strengths, risks, or suggestions. Reason about position sizing, concentration, recent transaction activity, and how the holdings align with the stated thesis.

Return markdown with exactly these sections in this order:

## Overview
## Strengths
## Risks
## Suggestions

End with a single italic line: *This is informational analysis, not financial advice.*

If the portfolio has no holdings, return a brief Overview noting that, and a single bullet under each remaining section explaining the portfolio is empty and the user should add transactions first.
If the user has not provided notes, ground the analysis in the holdings and transaction patterns alone and note that no thesis was stated.`;

export function getAnalysis(portfolioId: number): PortfolioAnalysis | null {
  const row = db
    .prepare('SELECT * FROM portfolio_analyses WHERE portfolio_id = ?')
    .get(portfolioId) as PortfolioAnalysis | undefined;
  return row ?? null;
}

export async function generateAnalysis(portfolioId: number): Promise<PortfolioAnalysis> {
  const portfolio = portfolioService.getPortfolioById(portfolioId);
  if (!portfolio) throw new AppError(404, 'Portfolio not found');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AppError(500, 'ANTHROPIC_API_KEY not configured on server');
  }

  const enriched = await holdingsEnrichment.getEnrichedHoldings(portfolioId);
  const transactions = transactionService.getTransactionsByPortfolio(portfolioId);

  const userPayload = {
    notes: portfolio.notes ?? '',
    totals: { cost: enriched.totalCost, value: enriched.totalValue },
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
      ticker: t.ticker,
      type: t.type,
      shares: t.shares,
      price: t.price,
      date: t.date,
    })),
  };

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(userPayload, null, 2) }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new AppError(502, `Claude API request failed: ${message}`);
  }

  const content = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!content) {
    throw new AppError(502, 'Claude returned an empty response');
  }

  db.prepare(
    `INSERT INTO portfolio_analyses (portfolio_id, content, model)
     VALUES (?, ?, ?)
     ON CONFLICT(portfolio_id) DO UPDATE SET
       content = excluded.content,
       model = excluded.model,
       generated_at = datetime('now')`,
  ).run(portfolioId, content, MODEL);

  return getAnalysis(portfolioId)!;
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: both PASS, no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/analysisService.ts
git commit -m "Add analysisService for portfolio AI analysis"
```

---

## Task 6: Add `GET` and `POST` analysis routes

**Files:**
- Modify: `server/src/routes/portfolios.ts`

- [ ] **Step 1: Add the import**

In `server/src/routes/portfolios.ts`, add to the imports:

```ts
import * as analysisService from '../services/analysisService.js';
```

- [ ] **Step 2: Add the two routes**

Add the following two route handlers above the `export default router;` line:

```ts
router.get('/:id/analysis', (req, res) => {
  const id = parseInt(req.params.id);
  const portfolio = portfolioService.getPortfolioById(id);
  if (!portfolio) throw new AppError(404, 'Portfolio not found');
  res.json(analysisService.getAnalysis(id));
});

router.post('/:id/analysis', async (req, res) => {
  const id = parseInt(req.params.id);
  const analysis = await analysisService.generateAnalysis(id);
  res.json(analysis);
});
```

(Note: `generateAnalysis` itself throws `AppError(404)` when the portfolio is missing, so the POST handler doesn't need a separate existence check. Express 5 forwards async errors to the error middleware automatically.)

- [ ] **Step 3: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: both PASS, no errors.

- [ ] **Step 4: Manual check — `GET` returns null for portfolio with no analysis**

Start the server (`npm run dev --prefix server`).

```bash
curl -s -i http://localhost:3001/api/portfolios/1/analysis
```

Expected: `200 OK`, body `null`.

```bash
curl -s -i http://localhost:3001/api/portfolios/9999/analysis
```

Expected: `404`, body `{"error":"Portfolio not found"}`.

- [ ] **Step 5: Manual check — `POST` without API key returns a clear error**

With `ANTHROPIC_API_KEY` **unset** in the server environment:

```bash
curl -s -i -X POST http://localhost:3001/api/portfolios/1/analysis
```

Expected: `500`, body `{"error":"ANTHROPIC_API_KEY not configured on server"}`.

- [ ] **Step 6: Manual check — `POST` with API key generates and persists**

Stop the server. Restart with the key:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run dev --prefix server
```

Pick a portfolio id with at least one transaction. Then:

```bash
curl -s -X POST http://localhost:3001/api/portfolios/1/analysis | head -c 800
curl -s http://localhost:3001/api/portfolios/1/analysis | head -c 800
```

Expected: first call returns a `PortfolioAnalysis` with a markdown `content` containing the four required headings; second call returns the same row.

Run a second `POST` and confirm `generated_at` is updated and `content` is replaced (not appended).

Stop the server.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/portfolios.ts
git commit -m "Add GET/POST /api/portfolios/:id/analysis routes"
```

---

## Task 7: Install `react-markdown` on the client

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run:

```bash
npm install react-markdown
```

Expected: install succeeds; `react-markdown` appears in root `package.json` `dependencies`.

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install react-markdown for analysis rendering"
```

---

## Task 8: Add `usePortfolioAnalysis` hook

**Files:**
- Create: `src/hooks/usePortfolioAnalysis.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/usePortfolioAnalysis.ts` with:

```ts
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { PortfolioAnalysis } from '@shared/types';

export function usePortfolioAnalysis(portfolioId: number) {
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<PortfolioAnalysis | null>(
        `/portfolios/${portfolioId}/analysis`,
      );
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analysis');
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const generate = useCallback(async () => {
    try {
      setGenerating(true);
      setError(null);
      const data = await api.post<PortfolioAnalysis>(
        `/portfolios/${portfolioId}/analysis`,
        {},
      );
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate analysis');
    } finally {
      setGenerating(false);
    }
  }, [portfolioId]);

  return { analysis, loading, generating, error, generate };
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePortfolioAnalysis.ts
git commit -m "Add usePortfolioAnalysis hook"
```

---

## Task 9: Add `AnalysisPanel` component

**Files:**
- Create: `src/components/AnalysisPanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/AnalysisPanel.tsx` with:

```tsx
import ReactMarkdown from 'react-markdown';
import { usePortfolioAnalysis } from '../hooks/usePortfolioAnalysis';

interface Props {
  portfolioId: number;
}

export function AnalysisPanel({ portfolioId }: Props) {
  const { analysis, loading, generating, error, generate } = usePortfolioAnalysis(portfolioId);

  const handleClick = async () => {
    if (analysis) {
      const ok = window.confirm(
        'Replace the existing analysis? The previous one cannot be recovered.',
      );
      if (!ok) return;
    }
    await generate();
  };

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h3 style={{ margin: 0 }}>AI Analysis</h3>
        <button
          className="btn-primary"
          onClick={handleClick}
          disabled={generating || loading}
        >
          {generating
            ? 'Generating...'
            : analysis
              ? 'Regenerate Analysis'
              : 'Generate Analysis'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading analysis...</div>
      ) : analysis ? (
        <>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Generated {new Date(analysis.generated_at + 'Z').toLocaleString()} · {analysis.model}
          </div>
          <div className="markdown-body">
            <ReactMarkdown>{analysis.content}</ReactMarkdown>
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No analysis yet. Click <strong>Generate Analysis</strong> to produce an expert opinion
          based on this portfolio&apos;s holdings, transactions, and notes.
        </div>
      )}
    </div>
  );
}
```

(Note on the timestamp: SQLite's `datetime('now')` returns UTC without a `Z` suffix. Appending `'Z'` before passing to `new Date(...)` ensures it's parsed as UTC, not local time.)

- [ ] **Step 2: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AnalysisPanel.tsx
git commit -m "Add AnalysisPanel component"
```

---

## Task 10: Render `AnalysisPanel` in `PortfolioDetail`

**Files:**
- Modify: `src/components/PortfolioDetail.tsx`

- [ ] **Step 1: Import the component**

At the top of `src/components/PortfolioDetail.tsx`, add to the existing import block:

```ts
import { AnalysisPanel } from './AnalysisPanel';
```

- [ ] **Step 2: Render between notes and `HoldingsSummary`**

In the JSX, locate the closing `</div>` of the notes block (the `<div>` that contains the textarea and the `notesSaving` indicator). Immediately after that closing `</div>`, and before the existing `<HoldingsSummary ... />`, insert:

```tsx
<AnalysisPanel portfolioId={portfolioId} />
```

- [ ] **Step 3: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: both PASS.

- [ ] **Step 4: Manual UI check (no API key needed for empty state)**

Start the dev servers: `npm run dev` (without `ANTHROPIC_API_KEY`).
Open `http://localhost:5173`, navigate to any portfolio's detail page.

Expected:
- A new "AI Analysis" card appears between the notes textarea and the holdings summary.
- It shows the empty-state copy and a **Generate Analysis** button.
- Clicking the button shows a 500 error inline ("ANTHROPIC_API_KEY not configured…"). The empty-state UI remains usable.

Stop the dev servers.

- [ ] **Step 5: Manual UI check with API key — full flow**

Start with the key: `ANTHROPIC_API_KEY=sk-ant-... npm run dev`.

Test these in the browser:
1. Portfolio with **no transactions**: click Generate. After ~5–20s, an analysis renders with the four required sections (per the system prompt, sections will note the portfolio is empty).
2. Portfolio **with transactions and notes**: click Generate. Analysis renders with markdown headings, bullets, and references to specific tickers and the notes content.
3. Click **Regenerate** on a portfolio that already has an analysis. Confirm dialog appears. Cancel — content unchanged. Confirm — content is replaced and timestamp updates.
4. Reload the page — the analysis persists.
5. Delete the portfolio (from the portfolio list page) and recreate one with the same name — confirm the analysis row was cascade-deleted (no analysis on the new portfolio).

Stop the dev servers.

- [ ] **Step 6: Commit**

```bash
git add src/components/PortfolioDetail.tsx
git commit -m "Render AnalysisPanel on portfolio detail page"
```

---

## Task 11: Document `ANTHROPIC_API_KEY` and the new endpoints

**Files:**
- Modify: `README.md`, `docker-compose.prod.yml`

- [ ] **Step 1: Update `README.md` — env var section**

In `README.md`, after the "Prerequisites" section (line ~13), add a new "Environment variables" section:

```markdown
## Environment variables

| Variable | Required for | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI analysis feature | Anthropic API key. Without it the rest of the app works; only the **Generate Analysis** button on the portfolio detail page will fail. |

In development, set it inline when starting the backend:

\`\`\`sh
ANTHROPIC_API_KEY=sk-ant-... npm run dev
\`\`\`
```

(Use real triple-backticks in the actual file — the escaped ones above are just so this plan doc itself renders correctly.)

- [ ] **Step 2: Update `README.md` — API endpoints table**

In the "API Endpoints" table at the bottom of `README.md`, add two rows after the existing `/api/portfolios/:id` rows:

```markdown
| `GET` | `/api/portfolios/:id/analysis` | Get the latest AI analysis for a portfolio (or null) |
| `POST` | `/api/portfolios/:id/analysis` | Generate (and replace) the AI analysis for a portfolio |
```

- [ ] **Step 3: Update `docker-compose.prod.yml`**

Replace the `environment:` section so `ANTHROPIC_API_KEY` is passed through from the host environment. The block becomes:

```yaml
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

- [ ] **Step 4: Commit**

```bash
git add README.md docker-compose.prod.yml
git commit -m "Document ANTHROPIC_API_KEY and analysis endpoints"
```

---

## Task 12: Final verification

- [ ] **Step 1: Clean install + full build**

```bash
npm install
npm install --prefix server
npm run build
npm run lint
```

Expected: install completes, build passes, lint passes.

- [ ] **Step 2: End-to-end smoke test**

Start the app: `ANTHROPIC_API_KEY=sk-ant-... npm run dev`.

In the browser:
- [ ] Empty-state card renders on a portfolio detail page.
- [ ] Generating analysis on a populated portfolio with notes returns a 4-section markdown analysis that references specific holdings and the notes content.
- [ ] Regenerate confirm dialog works (cancel preserves content; confirm replaces it).
- [ ] Reloading the page shows the persisted analysis with the correct timestamp.
- [ ] Deleting a portfolio cascades the analysis row away (verify by recreating with the same name; analysis is empty).

- [ ] **Step 3: Confirm no uncommitted changes**

```bash
git status
```

Expected: working tree clean.
