import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TickerSearchInput } from './TickerSearchInput';

vi.mock('../hooks/useTickerSearch', () => ({
  useTickerSearch: () => ({
    results: [],
    loading: false,
    search: vi.fn(),
    clear: vi.fn(),
  }),
}));

describe('TickerSearchInput', () => {
  it('renders the input with the given value', () => {
    const html = renderToStaticMarkup(
      <TickerSearchInput value="AAPL" onChange={vi.fn()} />,
    );
    expect(html).toContain('value="AAPL"');
    expect(html).toContain('Search ticker');
  });

  it('does not show a hint when the value matches the initial query', () => {
    const html = renderToStaticMarkup(
      <TickerSearchInput value="AAPL" onChange={vi.fn()} />,
    );
    expect(html).not.toContain('Select a ticker from the dropdown');
  });
});
