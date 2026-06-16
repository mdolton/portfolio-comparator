import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Holding } from '@shared/types';
import { HoldingsSummary } from './HoldingsSummary';

const holding = (partial: Partial<Holding>): Holding => ({
  ticker: 'AAPL',
  shares: 1,
  avgCost: 100,
  totalCost: 100,
  currentPrice: 110,
  marketValue: 110,
  gainLoss: 10,
  gainLossPercent: 10,
  ...partial,
});

describe('HoldingsSummary', () => {
  it('does not render zero-share holdings in the current holdings table', () => {
    const html = renderToStaticMarkup(
      <HoldingsSummary
        holdings={[
          holding({ ticker: 'AAPL', shares: 3 }),
          holding({ ticker: 'MSFT', shares: 0 }),
        ]}
        securitiesValue={330}
        cash={0}
        totalCost={300}
        totalValue={330}
      />,
    );

    expect(html).toContain('AAPL');
    expect(html).not.toContain('MSFT');
  });

  it('does not render holdings whose market value rounds to $0.00', () => {
    const html = renderToStaticMarkup(
      <HoldingsSummary
        holdings={[
          holding({ ticker: 'AAPL', shares: 3, marketValue: 330 }),
          holding({ ticker: 'MSFT', shares: 0.00004, marketValue: 0.004 }),
        ]}
        securitiesValue={330.004}
        cash={0}
        totalCost={300}
        totalValue={330.004}
      />,
    );

    expect(html).toContain('AAPL');
    expect(html).not.toContain('MSFT');
    expect(html).not.toContain('0.0000');
  });

  it('renders tiny-share holdings with meaningful market value', () => {
    const html = renderToStaticMarkup(
      <HoldingsSummary
        holdings={[holding({ ticker: 'BRK.A', shares: 0.00004, marketValue: 25 })]}
        securitiesValue={25}
        cash={0}
        totalCost={20}
        totalValue={25}
      />,
    );

    expect(html).toContain('BRK.A');
    expect(html).toContain('$25.00');
  });
});
