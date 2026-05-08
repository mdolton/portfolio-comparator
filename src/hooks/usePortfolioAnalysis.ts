import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { PortfolioAnalysis } from '@shared/types';

export function usePortfolioAnalysis(portfolioId: number) {
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<PortfolioAnalysis | null>(
        `/portfolios/${portfolioId}/analysis`,
      );
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analysis');
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const generate = useCallback(async () => {
    try {
      setGenerating(true);
      setError(null);
      const data = await api.post<PortfolioAnalysis>(
        `/portfolios/${portfolioId}/analysis`,
        {},
      );
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate analysis');
    } finally {
      setGenerating(false);
    }
  }, [portfolioId]);

  return { analysis, loading, generating, error, generate };
}
