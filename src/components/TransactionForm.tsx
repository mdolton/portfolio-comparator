import { useState } from 'react';
import { TickerSearchInput } from './TickerSearchInput';

interface Props {
  onSubmit: (data: {
    ticker: string;
    type: 'buy' | 'sell';
    shares: number;
    price: number;
    date: string;
  }) => Promise<void>;
}

export function TransactionForm({ onSubmit }: Props) {
  const [ticker, setTicker] = useState('');
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !shares || !price || !date) return;

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit({
        ticker: ticker.toUpperCase(),
        type,
        shares: parseFloat(shares),
        price: parseFloat(price),
        date,
      });
      setTicker('');
      setShares('');
      setPrice('');
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
          <label>Ticker</label>
          <TickerSearchInput value={ticker} onChange={setTicker} />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as 'buy' | 'sell')} style={{ width: '100%' }}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </div>
        <div className="form-group">
          <label>Shares</label>
          <input
            type="number"
            step="any"
            min="0.0001"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="0"
            style={{ width: '100%' }}
          />
        </div>
        <div className="form-group">
          <label>Price</label>
          <input
            type="number"
            step="any"
            min="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            style={{ width: '100%' }}
          />
        </div>
        <div className="form-group">
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      </div>
      <button type="submit" className="btn-primary" disabled={submitting || !ticker || !shares || !price}>
        {submitting ? 'Adding...' : 'Add Transaction'}
      </button>
    </form>
  );
}
