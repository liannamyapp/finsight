import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { periodToRange, useFiltersStore } from '../store/filters';
import { api, qs } from './client';
import type {
  AuthResponse,
  ImportJob,
  InsightsResponse,
  NewTransaction,
  Paginated,
  Summary,
  Transaction,
  TxType,
} from './types';

/** Query keys in one place so invalidation stays consistent. */
export const keys = {
  summary: (period: string) => ['summary', period] as const,
  transactions: (period: string, params: object) => ['transactions', period, params] as const,
  categories: ['categories'] as const,
  importJob: (id: string | null) => ['import', id] as const,
};

const invalidateFinancialData = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ['summary'] }),
    qc.invalidateQueries({ queryKey: ['transactions'] }),
    qc.invalidateQueries({ queryKey: keys.categories }),
  ]);

export function useLogin() {
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: { email: string; password: string; name: string }) =>
      api<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useSummary() {
  const period = useFiltersStore((s) => s.period);
  return useQuery({
    queryKey: keys.summary(period),
    queryFn: () => api<Summary>(`/analytics/summary${qs(periodToRange(period))}`),
  });
}

export interface TransactionFilters {
  page: number;
  type?: TxType;
  category?: string;
}

export function useTransactions(filters: TransactionFilters) {
  const period = useFiltersStore((s) => s.period);
  return useQuery({
    queryKey: keys.transactions(period, filters),
    queryFn: () =>
      api<Paginated<Transaction>>(
        `/transactions${qs({ ...periodToRange(period), ...filters, pageSize: 15 })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api<string[]>('/transactions/categories'),
    staleTime: 60_000,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewTransaction) =>
      api<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidateFinancialData(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateFinancialData(qc),
  });
}

export function useStartImport() {
  return useMutation({
    mutationFn: (csv: string) => api<ImportJob>('/imports', { method: 'POST', body: JSON.stringify({ csv }) }),
  });
}

/** Polls the background import job every second until it finishes. */
export function useImportJob(id: string | null) {
  return useQuery({
    queryKey: keys.importJob(id),
    queryFn: () => api<ImportJob>(`/imports/${id}`),
    enabled: id !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'DONE' || status === 'FAILED' ? false : 1000;
    },
  });
}

export function useRefreshAfterImport() {
  const qc = useQueryClient();
  return () => invalidateFinancialData(qc);
}

export function useInsights() {
  const period = useFiltersStore((s) => s.period);
  return useMutation({
    mutationFn: () =>
      api<InsightsResponse>('/insights', { method: 'POST', body: JSON.stringify(periodToRange(period)) }),
  });
}
