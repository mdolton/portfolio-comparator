# Portfolio Notes Markdown View + Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-editable notes textarea on the portfolio detail page with a read-only markdown-rendered view that has an Edit button opening an inline textarea with Save/Cancel.

**Architecture:** Frontend-only change in `src/components/PortfolioDetail.tsx`. View mode renders saved notes (`portfolio.notes`) with `ReactMarkdown` + `remarkGfm` inside `div.markdown-body` — the same pattern as `AnalysisPanel.tsx`. Edit mode swaps in the existing auto-resizing textarea with Save/Cancel buttons. No backend, API, or dependency changes.

**Tech Stack:** React 19, TypeScript, react-markdown 10, remark-gfm 4, Vitest (with `renderToStaticMarkup`, node environment).

**Spec:** `docs/superpowers/specs/2026-08-04-portfolio-notes-markdown-edit-design.md`

## Global Constraints

- No new npm dependencies. `react-markdown` and `remark-gfm` are already in `package.json`.
- No backend or shared-types changes; use the existing `notes` field and
  `usePortfolioDetail().updatePortfolio({ notes })`.
- Follow existing CSS classes: `btn-primary`, `btn-outline`, `btn-sm`, `markdown-body`
  (all defined in `src/index.css`).
- `npm run test`, `npm run build`, and `npm run lint` must pass.

## File Structure

- **Modify:** `src/components/PortfolioDetail.tsx` — the only production file. Replace the
  always-editable textarea block (lines 58-80) with view/edit mode rendering; add `editing`
  and `saveError` state; remove the blur-save handler; view mode renders `portfolio.notes`
  directly (not the local `notes` state, which only backs the textarea while editing).
- **Create:** `src/components/PortfolioDetail.test.tsx` — static-markup tests following the
  pattern in `src/components/AnalysisPanel.test.tsx` (mock hooks with `vi.mock`, render with
  `renderToStaticMarkup`). Tests cover view mode only: markdown rendering, Edit button, and
  the empty state. Edit-mode interaction is not unit-testable with the current tooling
  (node environment, no testing-library/jsdom) and is verified manually.

Key design note for the test: `renderToStaticMarkup` does not run `useEffect`, so the
existing `useEffect` that syncs `portfolio.notes` into local `notes` state would leave the
rendered view empty in tests. View mode therefore renders `portfolio.notes` directly, and
entering edit mode copies it into local state. The sync `useEffect` is removed.

---

### Task 1: Markdown notes view with inline edit mode

**Files:**
- Create: `src/components/PortfolioDetail.test.tsx`
- Modify: `src/components/PortfolioDetail.tsx`

**Interfaces:**
- Consumes: `usePortfolioDetail(portfolioId)` → `{ portfolio, loading, error, refetch, updatePortfolio }`
  from `src/hooks/usePortfolios.ts`; `useTransactions(portfolioId)` from
  `src/hooks/useTransactions.ts`; `PortfolioWithHoldings.notes: string` (empty string when
  unset) from `@shared/types`.
- Produces: no new exported interface; `PortfolioDetail`'s props stay
  `{ portfolioId: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/components/PortfolioDetail.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PortfolioDetail } from './PortfolioDetail';

const DEFAULT_NOTES =
  '## Thesis\n\nA ~~risky~~ **bold** call.\n\n| Ticker | View |\n| ------ | ---- |\n| AAPL   | Hold |';

const portfolio = {
  id: 1,
  name: 'Test Portfolio',
  notes: DEFAULT_NOTES,
  created_at: '2026-01-01 00:00:00',
  holdings: [],
  securitiesValue: 0,
  cash: 0,
  totalCost: 0,
  totalValue: 0,
};

vi.mock('../hooks/usePortfolios', () => ({
  usePortfolioDetail: () => ({
    portfolio,
    loading: false,
    error: null,
    refetch: vi.fn(),
    updatePortfolio: vi.fn(),
  }),
}));

vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: [],
    loading: false,
    error: null,
    addTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
  }),
}));

function renderDetail() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <PortfolioDetail portfolioId={1} />
    </MemoryRouter>,
  );
}

describe('PortfolioDetail notes', () => {
  beforeEach(() => {
    portfolio.notes = DEFAULT_NOTES;
  });

  it('renders saved notes as markdown with an Edit button', () => {
    const html = renderDetail();

    expect(html).toContain('<h2>Thesis</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<del>risky</del>');
    expect(html).toContain('<td>AAPL</td>');
    expect(html).toContain('markdown-body');
    expect(html).toContain('Edit');
    expect(html).not.toContain('<textarea');
  });

  it('shows a placeholder when there are no notes', () => {
    portfolio.notes = '';
    const html = renderDetail();

    expect(html).toContain('No notes yet');
    expect(html).toContain('Edit');
    expect(html).not.toContain('<textarea');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PortfolioDetail.test.tsx`
Expected: FAIL — first test fails because the current component renders a `<textarea`
and no `markdown-body` / rendered markdown.

- [ ] **Step 3: Implement view/edit modes in PortfolioDetail.tsx**

Replace the full contents of `src/components/PortfolioDetail.tsx` with:

```tsx
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePortfolioDetail } from '../hooks/usePortfolios';
import { useTransactions } from '../hooks/useTransactions';
import { TransactionForm } from './TransactionForm';
import { TransactionTable } from './TransactionTable';
import { HoldingsSummary } from './HoldingsSummary';
import { AnalysisPanel } from './AnalysisPanel';

interface Props {
  portfolioId: number;
}

export function PortfolioDetail({ portfolioId }: Props) {
  const { portfolio, loading: pLoading, error: pError, refetch: refetchPortfolio, updatePortfolio } = usePortfolioDetail(portfolioId);
  const { transactions, loading: tLoading, error: tError, addTransaction, deleteTransaction } = useTransactions(portfolioId);
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = notesRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + 2}px`;
    }
  }, [notes, editing]);

  if (pLoading) return <div className="loading">Loading portfolio...</div>;
  if (pError) return <div className="error-message">{pError}</div>;
  if (!portfolio) return <div className="error-message">Portfolio not found</div>;

  const handleEdit = () => {
    setNotes(portfolio.notes || '');
    setSaveError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setNotesSaving(true);
    setSaveError(null);
    try {
      await updatePortfolio({ notes });
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setNotesSaving(false);
    }
  };

  const handleCancel = () => {
    setSaveError(null);
    setEditing(false);
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/portfolios" style={{ fontSize: '0.875rem' }}>&larr; Back to Portfolios</Link>
      </div>

      <h2 style={{ marginBottom: '0.5rem' }}>{portfolio.name}</h2>

      <div style={{ marginBottom: '1rem' }}>
        {editing ? (
          <>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this portfolio... (markdown supported)"
              autoFocus
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text)',
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                overflow: 'hidden',
              }}
            />
            {saveError && <div className="error-message">{saveError}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="btn-primary btn-sm" onClick={handleSave} disabled={notesSaving}>
                {notesSaving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn-outline btn-sm" onClick={handleCancel} disabled={notesSaving}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
              <button className="btn-outline btn-sm" onClick={handleEdit}>
                Edit
              </button>
            </div>
            {portfolio.notes ? (
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{portfolio.notes}</ReactMarkdown>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No notes yet — click <strong>Edit</strong> to add some.
              </div>
            )}
          </>
        )}
      </div>

      <AnalysisPanel portfolioId={portfolioId} />

      <HoldingsSummary
        holdings={portfolio.holdings}
        securitiesValue={portfolio.securitiesValue}
        cash={portfolio.cash}
        totalCost={portfolio.totalCost}
        totalValue={portfolio.totalValue}
      />

      <TransactionForm
        onSubmit={async (data) => {
          await addTransaction(data);
          await refetchPortfolio();
        }}
      />

      <div className="card">
        <h3 style={{ marginBottom: '0.75rem' }}>Transactions</h3>
        {tLoading ? (
          <div className="loading">Loading transactions...</div>
        ) : tError ? (
          <div className="error-message">{tError}</div>
        ) : (
          <TransactionTable
            transactions={transactions}
            onDelete={async (id) => {
              await deleteTransaction(id);
              await refetchPortfolio();
            }}
          />
        )}
      </div>
    </div>
  );
}
```

Changes vs. the current file:
- New imports: `ReactMarkdown`, `remarkGfm`.
- New state: `editing`, `saveError`; removed the `useEffect` that synced `portfolio.notes`
  into `notes` (view mode reads `portfolio.notes` directly; `handleEdit` seeds the textarea).
- Removed `handleNotesBlur` (blur-to-save is gone).
- Auto-resize `useEffect` now also depends on `editing` so the textarea sizes correctly
  when it mounts.
- Notes block is view/edit conditional as shown.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PortfolioDetail.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Run full test suite, build, and lint**

Run: `npm run test && npm run build && npm run lint`
Expected: all pass with no errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open a portfolio detail page, and verify:
1. Existing notes render as markdown (headings, lists, bold, links).
2. Clicking Edit swaps to the textarea pre-filled with the raw markdown.
3. Save persists and re-renders markdown (reload to confirm it saved).
4. Cancel discards changes.
5. A portfolio with no notes shows the "No notes yet" placeholder.

- [ ] **Step 7: Commit**

```bash
git add src/components/PortfolioDetail.tsx src/components/PortfolioDetail.test.tsx
git commit -m "Render portfolio notes as markdown with inline edit mode"
```
