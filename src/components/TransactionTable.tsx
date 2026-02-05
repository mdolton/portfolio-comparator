import type { Transaction } from '@shared/types';
import { formatCurrency, formatShares, formatDate } from '../utils/formatting';

interface Props {
  transactions: Transaction[];
  onDelete: (id: number) => Promise<void>;
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
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td>{formatDate(tx.date)}</td>
              <td style={{ fontWeight: 600 }}>{tx.ticker}</td>
              <td>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.125rem 0.5rem',
                    borderRadius: 12,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: tx.type === 'buy' ? '#dcfce7' : '#fee2e2',
                    color: tx.type === 'buy' ? '#166534' : '#991b1b',
                  }}
                >
                  {tx.type.toUpperCase()}
                </span>
              </td>
              <td>{formatShares(tx.shares)}</td>
              <td>{formatCurrency(tx.price)}</td>
              <td>{formatCurrency(tx.shares * tx.price)}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
