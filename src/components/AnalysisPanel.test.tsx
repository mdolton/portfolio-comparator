import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AnalysisPanel } from './AnalysisPanel';

vi.mock('../hooks/usePortfolioAnalysis', () => ({
  usePortfolioAnalysis: () => ({
    analysis: {
      content: [
        '## Outlook',
        '',
        'A ~~bold~~ **bold** call.',
        '',
        '| Ticker | View |',
        '| ------ | ---- |',
        '| AAPL   | Hold |',
      ].join('\n'),
      generated_at: '2026-07-07 12:00:00',
      model: 'test-model',
    },
    loading: false,
    generating: false,
    error: null,
    generate: vi.fn(),
  }),
}));

describe('AnalysisPanel', () => {
  it('renders GFM tables and strikethrough in the analysis markdown', () => {
    const html = renderToStaticMarkup(<AnalysisPanel portfolioId={1} />);

    expect(html).toContain('<table>');
    expect(html).toContain('<th>Ticker</th>');
    expect(html).toContain('<td>AAPL</td>');
    expect(html).toContain('<del>bold</del>');
    expect(html).not.toContain('| Ticker |');
  });
});
