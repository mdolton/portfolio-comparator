import type { Transaction } from '@shared/types';
import { formatCurrency, formatShares, formatDate } from '../utils/formatting';

interface Props {
  transactions: Transaction[];
  onDelete: (id: number) => Promise<void>;
}

const TYPE_STYLES: Record<Transaction['type'], { bg: string; color: string }> = {
  buy: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
  sell: { bg: 'var(--danger-bg)', color: 'var(--danger-text)' },
  deposit: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
  withdrawal: { bg: 'var(--danger-bg)', color: 'var(--danger-text)' },
  dividend: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
};

function cashEffect(tx: Transaction): number {
  switch (tx.type) {
    case 'buy':
      return -((tx.shares ?? 0) * (tx.price ?? 0));
    case 'sell':
      return (tx.shares ?? 0) * (tx.price ?? 0);
    case 'withdrawal':
      return -(tx.amount ?? 0);
    default:
      return tx.amount ?? 0;
  }
}

export function TransactionTable({ transactions, onDelete }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <p>No transactions yet. Add one above.</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Ticker</th>
            <th>Type</th>
            <th>Shares</th>
            <th>Price</th>
            <th>Cash Effect</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const effect = cashEffect(tx);
            return (
              <tr key={tx.id}>
                <td>{formatDate(tx.date)}</td>
                <td style={{ fontWeight: 600 }}>{tx.ticker ?? '—'}</td>
                <td>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.125rem 0.5rem',
                      borderRadius: 12,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: TYPE_STYLES[tx.type].bg,
                      color: TYPE_STYLES[tx.type].color,
                    }}
                  >
                    {tx.type.toUpperCase()}
                  </span>
                </td>
                <td>{tx.shares != null ? formatShares(tx.shares) : '—'}</td>
                <td>{formatCurrency(tx.price)}</td>
                <td className={effect >= 0 ? 'positive' : 'negative'}>{formatCurrency(effect)}</td>
                <td>
                  <button
                    className="btn-danger btn-sm"
                    onClick={async () => {
                      try {
                        await onDelete(tx.id);
                      } catch (err) {
                        alert(err instanceof Error ? err.message : 'Failed to delete');
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
