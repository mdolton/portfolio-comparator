import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Transaction, CreateTransactionRequest } from '@shared/types';

export function useTransactions(portfolioId: number | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (portfolioId === null) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Transaction[]>(`/portfolios/${portfolioId}/transactions`);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = async (data: CreateTransactionRequest): Promise<Transaction> => {
    if (portfolioId === null) throw new Error('No portfolio selected');
    const tx = await api.post<Transaction>(`/portfolios/${portfolioId}/transactions`, data);
    await fetchTransactions();
    return tx;
  };

  const deleteTransaction = async (txId: number): Promise<void> => {
    await api.delete(`/transactions/${txId}`);
    await fetchTransactions();
  };

  return { transactions, loading, error, addTransaction, deleteTransaction, refetch: fetchTransactions };
}
