import { Link } from 'react-router-dom';
import { usePortfolioDetail } from '../hooks/usePortfolios';
import { useTransactions } from '../hooks/useTransactions';
import { TransactionForm } from './TransactionForm';
import { TransactionTable } from './TransactionTable';
import { HoldingsSummary } from './HoldingsSummary';

interface Props {
  portfolioId: number;
}

export function PortfolioDetail({ portfolioId }: Props) {
  const { portfolio, loading: pLoading, error: pError, refetch: refetchPortfolio } = usePortfolioDetail(portfolioId);
  const { transactions, loading: tLoading, error: tError, addTransaction, deleteTransaction } = useTransactions(portfolioId);

  if (pLoading) return <div className="loading">Loading portfolio...</div>;
  if (pError) return <div className="error-message">{pError}</div>;
  if (!portfolio) return <div className="error-message">Portfolio not found</div>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/portfolios" style={{ fontSize: '0.875rem' }}>&larr; Back to Portfolios</Link>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>{portfolio.name}</h2>

      <HoldingsSummary
        holdings={portfolio.holdings}
        totalValue={portfolio.totalValue}
        totalCost={portfolio.totalCost}
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
