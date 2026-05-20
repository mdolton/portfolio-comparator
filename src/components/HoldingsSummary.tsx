import type { Holding } from '@shared/types';
import { formatCurrency, formatPercent, formatShares } from '../utils/formatting';

interface Props {
  holdings: Holding[];
  securitiesValue: number | null;
  cash: number;
  totalCost: number;
  totalValue: number | null;
}

export function HoldingsSummary({ holdings, securitiesValue, cash, totalCost, totalValue }: Props) {
  if (holdings.length === 0 && cash === 0) {
    return null;
  }

  const gainLoss = securitiesValue !== null ? securitiesValue - totalCost : null;
  const gainLossPercent = gainLoss !== null && totalCost > 0 ? (gainLoss / totalCost) * 100 : null;

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Current Holdings</h3>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatCurrency(totalValue)}</div>
          {gainLoss !== null && (
            <div className={gainLoss >= 0 ? 'positive' : 'negative'} style={{ fontSize: '0.875rem' }}>
              {formatCurrency(gainLoss)} ({formatPercent(gainLossPercent)}) · securities
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
            <tr style={{ fontStyle: 'italic' }}>
              <td style={{ fontWeight: 600 }}>Cash</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>
                {formatCurrency(cash)}
                {totalValue !== null && totalValue > 0 && (
                  <span style={{ color: 'var(--color-muted)', marginLeft: '0.25rem' }}>
                    ({((cash / totalValue) * 100).toFixed(2)}%)
                  </span>
                )}
              </td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
