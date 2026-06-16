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
});
