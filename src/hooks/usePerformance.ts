import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { PerformanceResponse } from '@shared/types';

const EMPTY: PerformanceResponse = { value: [], growth: [] };

export function usePerformance() {
  const [data, setData] = useState<PerformanceResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(
    async (portfolioIds: number[], startDate: string, endDate: string) => {
      if (portfolioIds.length === 0) {
        setData(EMPTY);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const ids = portfolioIds.join(',');
        const result = await api.get<PerformanceResponse>(
          `/performance?ids=${ids}&start=${startDate}&end=${endDate}`,
        );
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch performance data');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { data, loading, error, fetchPerformance };
}
