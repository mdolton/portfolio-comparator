import { useState } from 'react';
import { TickerSearchInput } from './TickerSearchInput';
import type { CreateTransactionRequest, TransactionType } from '@shared/types';

interface Props {
  onSubmit: (data: CreateTransactionRequest) => Promise<void>;
}

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'dividend', label: 'Dividend' },
];

export function TransactionForm({ onSubmit }: Props) {
  const [type, setType] = useState<TransactionType>('buy');
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isTrade = type === 'buy' || type === 'sell';
  const isDividend = type === 'dividend';
  const isCash = type === 'deposit' || type === 'withdrawal';

  const canSubmit = isTrade ? !!ticker && !!shares && !!price : !!amount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !canSubmit) return;

    try {
      setSubmitting(true);
      setError(null);
      const payload: CreateTransactionRequest = isTrade
        ? { type, ticker: ticker.toUpperCase(), shares: parseFloat(shares), price: parseFloat(price), date }
        : { type, amount: parseFloat(amount), date, ticker: isDividend && ticker ? ticker.toUpperCase() : null };
      await onSubmit(payload);
      setTicker('');
      setShares('');
      setPrice('');
      setAmount('');
      setType('buy');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1rem' }}>
      <h3 style={{ marginBottom: '0.75rem' }}>Add Transaction</h3>
      {error && <div className="error-message">{error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as TransactionType)} style={{ width: '100%' }}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {(isTrade || isDividend) && (
          <div className="form-group">
            <label>Ticker{isDividend ? ' (optional)' : ''}</label>
            <TickerSearchInput value={ticker} onChange={setTicker} />
          </div>
        )}

        {isTrade && (
          <>
            <div className="form-group">
              <label>Shares</label>
              <input type="number" step="any" min="0.0001" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="0" style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label>Price</label>
              <input type="number" step="any" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" style={{ width: '100%' }} />
            </div>
          </>
        )}

        {(isCash || isDividend) && (
          <div className="form-group">
            <label>Amount</label>
            <input type="number" step="any" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ width: '100%' }} />
          </div>
        )}

        <div className="form-group">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>
      <button type="submit" className="btn-primary" disabled={submitting || !canSubmit}>
        {submitting ? 'Adding...' : 'Add Transaction'}
      </button>
    </form>
  );
}
