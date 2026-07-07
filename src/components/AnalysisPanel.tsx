import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePortfolioAnalysis } from '../hooks/usePortfolioAnalysis';

interface Props {
  portfolioId: number;
}

export function AnalysisPanel({ portfolioId }: Props) {
  const { analysis, loading, generating, error, generate } = usePortfolioAnalysis(portfolioId);

  const handleClick = async () => {
    if (analysis) {
      const ok = window.confirm(
        'Replace the existing analysis? The previous one cannot be recovered.',
      );
      if (!ok) return;
    }
    await generate();
  };

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h3 style={{ margin: 0 }}>AI Analysis</h3>
        <button
          className="btn-primary"
          onClick={handleClick}
          disabled={generating || loading}
        >
          {generating
            ? 'Generating...'
            : analysis
              ? 'Regenerate Analysis'
              : 'Generate Analysis'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading analysis...</div>
      ) : analysis ? (
        <>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Generated {new Date(analysis.generated_at + 'Z').toLocaleString()} · {analysis.model}
          </div>
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.content}</ReactMarkdown>
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No analysis yet. Click <strong>Generate Analysis</strong> to produce an expert opinion
          based on this portfolio&apos;s holdings, transactions, and notes.
        </div>
      )}
    </div>
  );
}
