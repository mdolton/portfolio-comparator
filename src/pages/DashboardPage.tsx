import { useState, useEffect } from 'react';
import type { PerformanceMetric } from '@shared/types';
import { usePortfolios } from '../hooks/usePortfolios';
import { usePerformance } from '../hooks/usePerformance';
import { PortfolioSelector } from '../components/PortfolioSelector';
import { PerformanceChart } from '../components/PerformanceChart';

function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export function DashboardPage() {
  const { portfolios, loading: portfoliosLoading } = usePortfolios();
  const { data, loading: perfLoading, error: perfError, fetchPerformance } = usePerformance();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [metric, setMetric] = useState<PerformanceMetric>('growth');

  useEffect(() => {
    if (selectedIds.length > 0) {
      fetchPerformance(selectedIds, dateRange.start, dateRange.end);
    }
  }, [selectedIds, dateRange, fetchPerformance]);

  if (portfoliosLoading) return <div className="loading">Loading...</div>;

  if (portfolios.length === 0) {
    return (
      <div className="empty-state">
        <h3>No portfolios yet</h3>
        <p>Create portfolios and add transactions to compare performance.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Performance Comparison</h2>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Select Portfolios
            </label>
            <PortfolioSelector
              portfolios={portfolios}
              selected={selectedIds}
              onChange={setSelectedIds}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Start
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                End
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      {perfError && <div className="error-message">{perfError}</div>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <div
            style={{
              display: 'inline-flex',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
            }}
          >
            {(['value', 'growth'] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMetric(m)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: metric === m ? 'var(--primary)' : 'transparent',
                  color: metric === m ? '#fff' : 'var(--text-muted)',
                }}
              >
                {m === 'value' ? 'Value' : 'Growth %'}
              </button>
            ))}
          </div>
        </div>
        <PerformanceChart
          data={data[metric]}
          metric={metric}
          portfolios={portfolios}
          selectedIds={selectedIds}
          loading={perfLoading}
        />
      </div>
    </div>
  );
}
