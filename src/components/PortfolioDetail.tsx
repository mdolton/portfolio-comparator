import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const [editing, setEditing] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = notesRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + 2}px`;
    }
  }, [notes, editing]);

  if (pLoading) return <div className="loading">Loading portfolio...</div>;
  if (pError) return <div className="error-message">{pError}</div>;
  if (!portfolio) return <div className="error-message">Portfolio not found</div>;

  const handleEdit = () => {
    setNotes(portfolio.notes || '');
    setSaveError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setNotesSaving(true);
    setSaveError(null);
    try {
      await updatePortfolio({ notes });
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setNotesSaving(false);
    }
  };

  const handleCancel = () => {
    setSaveError(null);
    setEditing(false);
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/portfolios" style={{ fontSize: '0.875rem' }}>&larr; Back to Portfolios</Link>
      </div>

      <h2 style={{ marginBottom: '0.5rem' }}>{portfolio.name}</h2>

      <div style={{ marginBottom: '1rem' }}>
        {editing ? (
          <>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this portfolio... (markdown supported)"
              autoFocus
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
            {saveError && <div className="error-message">{saveError}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="btn-primary btn-sm" onClick={handleSave} disabled={notesSaving}>
                {notesSaving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn-outline btn-sm" onClick={handleCancel} disabled={notesSaving}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
              <button className="btn-outline btn-sm" onClick={handleEdit}>
                Edit
              </button>
            </div>
            {portfolio.notes ? (
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{portfolio.notes}</ReactMarkdown>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No notes yet — click <strong>Edit</strong> to add some.
              </div>
            )}
          </>
        )}
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
