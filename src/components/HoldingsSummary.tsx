import type { Holding } from '@shared/types';
import { formatCurrency, formatPercent, formatShares } from '../utils/formatting';

interface Props {
  holdings: Holding[];
  totalValue: number | null;
  totalCost: number;
}

export function HoldingsSummary({ holdings, totalValue, totalCost }: Props) {
  if (holdings.length === 0) {
    return null;
  }

  const totalGainLoss = totalValue !== null ? totalValue - totalCost : null;
  const totalGainLossPercent =
    totalGainLoss !== null && totalCost > 0 ? (totalGainLoss / totalCost) * 100 : null;

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Current Holdings</h3>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {formatCurrency(totalValue)}
          </div>
          {totalGainLoss !== null && (
            <div className={totalGainLoss >= 0 ? 'positive' : 'negative'} style={{ fontSize: '0.875rem' }}>
              {formatCurrency(totalGainLoss)} ({formatPercent(totalGainLossPercent)})
            </div>
          )}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Shares</th>
              <th>Avg Cost</th>
              <th>Price</th>
              <th>Value</th>
              <th>Gain/Loss</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.ticker}>
                <td style={{ fontWeight: 600 }}>{h.ticker}</td>
                <td>{formatShares(h.shares)}</td>
                <td>{formatCurrency(h.avgCost)}</td>
                <td>{formatCurrency(h.currentPrice)}</td>
                <td>
                  {formatCurrency(h.marketValue)}
                  {h.marketValue !== null && totalValue !== null && totalValue > 0 && (
                    <span style={{ color: 'var(--color-muted)', marginLeft: '0.25rem' }}>
                      ({((h.marketValue / totalValue) * 100).toFixed(2)}%)
                    </span>
                  )}
                </td>
                <td>
                  {h.gainLoss !== null ? (
                    <span className={h.gainLoss >= 0 ? 'positive' : 'negative'}>
                      {formatCurrency(h.gainLoss)} ({formatPercent(h.gainLossPercent)})
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
