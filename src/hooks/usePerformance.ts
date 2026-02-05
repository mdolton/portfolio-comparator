import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { PerformancePoint } from '@shared/types';

export function usePerformance() {
  const [data, setData] = useState<PerformancePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(
    async (portfolioIds: number[], startDate: string, endDate: string) => {
      if (portfolioIds.length === 0) {
        setData([]);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const ids = portfolioIds.join(',');
        const result = await api.get<PerformancePoint[]>(
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
