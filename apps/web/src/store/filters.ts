import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Period = '3m' | '6m' | '12m' | 'all';

export const PERIOD_LABELS: Record<Period, string> = {
  '3m': '3 months',
  '6m': '6 months',
  '12m': '12 months',
  all: 'All time',
};

interface FiltersState {
  period: Period;
  setPeriod: (period: Period) => void;
}

/** Global UI filter shared by the dashboard and transactions pages. */
export const useFiltersStore = create<FiltersState>()(
  persist(
    (set) => ({
      period: '12m',
      setPeriod: (period) => set({ period }),
    }),
    { name: 'finsight-filters' },
  ),
);

export function periodToRange(period: Period, now = new Date()): { from?: string; to?: string } {
  if (period === 'all') return {};
  const months = { '3m': 3, '6m': 6, '12m': 12 }[period];
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}
