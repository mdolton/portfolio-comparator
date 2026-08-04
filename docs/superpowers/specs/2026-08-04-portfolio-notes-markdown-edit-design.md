# Portfolio Notes: Read-Only Markdown with Edit Mode

Date: 2026-08-04

## Problem

On the portfolio detail page, the portfolio notes ("description") currently live in an
always-editable `<textarea>` that saves on blur. The user wants the notes to be a regular
read-only page element, rendered as markdown, with an Edit button that opens a text box
for making changes.

## Scope

- Frontend only. No backend, API, or database changes — the `notes` field and
  `updatePortfolio({ notes })` already exist.
- No new dependencies — `react-markdown` and `remark-gfm` are already installed and
  already used in `src/components/AnalysisPanel.tsx`.

## Design

All changes are in `src/components/PortfolioDetail.tsx`, replacing the current
always-editable textarea block (lines 58-80).

### View mode (default)

- Notes rendered as markdown via `ReactMarkdown` with `remarkGfm` inside a
  `div.markdown-body` — the same pattern as `AnalysisPanel.tsx`, keeping styling
  and rendering consistent.
- An **Edit** button next to the notes switches to edit mode.
- Empty state: if there are no notes, show muted placeholder text
  ("No notes yet — click Edit to add some.").

### Edit mode

- Clicking Edit swaps the rendered view for the existing auto-resizing `<textarea>`
  (keep the current auto-resize behavior) plus **Save** and **Cancel** buttons.
- **Save** calls `updatePortfolio({ notes })`, shows the existing "Saving..."
  indicator while in flight, and returns to view mode on completion.
- **Cancel** discards local edits and returns to view mode without saving.
- The blur-to-save behavior is removed.

### State

- Add an `editing: boolean` state to `PortfolioDetail`.
- The existing `notes` string state continues to back the textarea while editing.

## Error handling

- `usePortfolioDetail.updatePortfolio` (`src/hooks/usePortfolios.ts:64`) does not catch
  API errors — a failed save rejects the promise. The Save handler must catch this,
  keep the user in edit mode (so their text is not lost), and show an error message.

## Testing

- The project has no test suite configured (per AGENTS.md). Verification is manual:
  `npm run dev`, edit notes with markdown (headings, lists, bold, links), save, and
  confirm the rendered view; confirm Cancel discards changes; confirm the empty state.
- `npm run build` and `npm run lint` must pass.
