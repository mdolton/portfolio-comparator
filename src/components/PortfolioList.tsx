import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreatePortfolioDialog } from './CreatePortfolioDialog';
import { usePortfolios } from '../hooks/usePortfolios';
import { formatDate } from '../utils/formatting';

export function PortfolioList() {
  const { portfolios, loading, error, createPortfolio, deletePortfolio } = usePortfolios();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (loading) return <div className="loading">Loading portfolios...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Portfolios</h2>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + New Portfolio
        </button>
      </div>

      {deleteError && <div className="error-message">{deleteError}</div>}

      {portfolios.length === 0 ? (
        <div className="empty-state">
          <h3>No portfolios yet</h3>
          <p>Create your first portfolio to start tracking investments.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {portfolios.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Link to={`/portfolios/${p.id}`} style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                  {p.name}
                </Link>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Created {formatDate(p.created_at)}
                </div>
              </div>
              <button
                className="btn-danger btn-sm"
                onClick={async () => {
                  if (!confirm(`Delete "${p.name}" and all its transactions?`)) return;
                  try {
                    setDeleteError(null);
                    await deletePortfolio(p.id);
                  } catch (err) {
                    setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
                  }
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePortfolioDialog
          onClose={() => setShowCreate(false)}
          onCreate={async (name) => {
            await createPortfolio({ name });
          }}
        />
      )}
    </div>
  );
}
