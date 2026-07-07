import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolioDetail } from '../hooks/usePortfolios';
import { useTransactions } from '../hooks/useTransactions';
import { TransactionForm } from './TransactionForm';
import { TransactionTable } from './TransactionTable';
import { HoldingsSummary } from './HoldingsSummary';
import { AnalysisPanel } from './AnalysisPanel';

interface Props {
  portfolioId: number;
}

export function PortfolioDetail({ portfolioId }: Props) {
  const { portfolio, loading: pLoading, error: pError, refetch: refetchPortfolio, updatePortfolio } = usePortfolioDetail(portfolioId);
  const { transactions, loading: tLoading, error: tError, addTransaction, deleteTransaction } = useTransactions(portfolioId);
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (portfolio) {
      setNotes(portfolio.notes || '');
    }
  }, [portfolio]);

  useEffect(() => {
    const el = notesRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + 2}px`;
    }
  }, [notes]);

  if (pLoading) return <div className="loading">Loading portfolio...</div>;
  if (pError) return <div className="error-message">{pError}</div>;
  if (!portfolio) return <div className="error-message">Portfolio not found</div>;

  const handleNotesBlur = async () => {
    if (notes !== (portfolio.notes || '')) {
      setNotesSaving(true);
      try {
        await updatePortfolio({ notes });
      } finally {
        setNotesSaving(false);
      }
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/portfolios" style={{ fontSize: '0.875rem' }}>&larr; Back to Portfolios</Link>
      </div>

      <h2 style={{ marginBottom: '0.5rem' }}>{portfolio.name}</h2>

      <div style={{ marginBottom: '1rem' }}>
        <textarea
          ref={notesRef}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add notes about this portfolio..."
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text)',
            resize: 'vertical',
            fontFamily: 'inherit',
            fontSize: '0.875rem',
            overflow: 'hidden',
          }}
        />
        {notesSaving && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saving...</span>}
      </div>

      <AnalysisPanel portfolioId={portfolioId} />

      <HoldingsSummary
        holdings={portfolio.holdings}
        securitiesValue={portfolio.securitiesValue}
        cash={portfolio.cash}
        totalCost={portfolio.totalCost}
        totalValue={portfolio.totalValue}
      />

      <TransactionForm
        onSubmit={async (data) => {
          await addTransaction(data);
          await refetchPortfolio();
        }}
      />

      <div className="card">
        <h3 style={{ marginBottom: '0.75rem' }}>Transactions</h3>
        {tLoading ? (
          <div className="loading">Loading transactions...</div>
        ) : tError ? (
          <div className="error-message">{tError}</div>
        ) : (
          <TransactionTable
            transactions={transactions}
            onDelete={async (id) => {
              await deleteTransaction(id);
              await refetchPortfolio();
            }}
          />
        )}
      </div>
    </div>
  );
}
