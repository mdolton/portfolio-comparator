import { useParams } from 'react-router-dom';
import { PortfolioList } from '../components/PortfolioList';
import { PortfolioDetail } from '../components/PortfolioDetail';

export function PortfolioPage() {
  const { id } = useParams<{ id: string }>();

  if (id) {
    return <PortfolioDetail portfolioId={parseInt(id)} />;
  }

  return <PortfolioList />;
}
