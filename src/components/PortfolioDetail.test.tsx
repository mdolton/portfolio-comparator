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
