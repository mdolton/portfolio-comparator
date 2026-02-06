import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Portfolio, PortfolioWithHoldings, CreatePortfolioRequest, UpdatePortfolioRequest } from '@shared/types';

export function usePortfolios() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolios = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Portfolio[]>('/portfolios');
      setPortfolios(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch portfolios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  const createPortfolio = async (data: CreatePortfolioRequest): Promise<Portfolio> => {
    const portfolio = await api.post<Portfolio>('/portfolios', data);
    await fetchPortfolios();
    return portfolio;
  };

  const deletePortfolio = async (id: number): Promise<void> => {
    await api.delete(`/portfolios/${id}`);
    await fetchPortfolios();
  };

  return { portfolios, loading, error, createPortfolio, deletePortfolio, refetch: fetchPortfolios };
}

export function usePortfolioDetail(id: number | null) {
  const [portfolio, setPortfolio] = useState<PortfolioWithHoldings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (id === null) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<PortfolioWithHoldings>(`/portfolios/${id}`);
      setPortfolio(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch portfolio');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const updatePortfolio = async (data: UpdatePortfolioRequest): Promise<void> => {
    if (id === null) return;
    await api.patch<Portfolio>(`/portfolios/${id}`, data);
    await fetchPortfolio();
  };

  return { portfolio, loading, error, refetch: fetchPortfolio, updatePortfolio };
}
