/**
 * Pure analytics functions. They operate on pre-aggregated rows
 * (month x type x category) produced by a single SQL GROUP BY, so the
 * amount of data moved from the database does not grow with the number
 * of transactions. Being pure, they are fully unit-tested without a DB.
 */

export type TxType = 'INCOME' | 'EXPENSE';

export type AggRow = {
  month: string; // YYYY-MM
  type: TxType;
  category: string;
  totalCents: number;
};

export type MonthlyPoint = {
  month: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

export type CategoryPoint = {
  category: string;
  amountCents: number;
  sharePct: number;
};

export type Summary = {
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
  marginPct: number | null;
  momIncomeChangePct: number | null;
  monthly: MonthlyPoint[];
  expenseByCategory: CategoryPoint[];
  topExpenseCategory: string | null;
};

export type CategorySpike = {
  category: string;
  month: string;
  lastCents: number;
  avgPrevCents: number;
  changePct: number;
};

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export function pctChange(prev: number, curr: number): number | null {
  if (prev === 0) return null;
  return round1(((curr - prev) / Math.abs(prev)) * 100);
}

export function buildSummary(rows: AggRow[]): Summary {
  const byMonth = new Map<string, MonthlyPoint>();
  const byCategory = new Map<string, number>();
  let income = 0;
  let expense = 0;

  for (const row of rows) {
    const point = byMonth.get(row.month) ?? {
      month: row.month,
      incomeCents: 0,
      expenseCents: 0,
      netCents: 0,
    };
    if (row.type === 'INCOME') {
      point.incomeCents += row.totalCents;
      income += row.totalCents;
    } else {
      point.expenseCents += row.totalCents;
      expense += row.totalCents;
      byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.totalCents);
    }
    point.netCents = point.incomeCents - point.expenseCents;
    byMonth.set(row.month, point);
  }

  const monthly = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  const expenseByCategory = [...byCategory.entries()]
    .map(([category, amountCents]) => ({
      category,
      amountCents,
      sharePct: expense ? round1((amountCents / expense) * 100) : 0,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);

  const net = income - expense;
  const last = monthly.at(-1);
  const prev = monthly.at(-2);

  return {
    totalIncomeCents: income,
    totalExpenseCents: expense,
    netCents: net,
    marginPct: income ? round1((net / income) * 100) : null,
    momIncomeChangePct: last && prev ? pctChange(prev.incomeCents, last.incomeCents) : null,
    monthly,
    expenseByCategory,
    topExpenseCategory: expenseByCategory[0]?.category ?? null,
  };
}

/**
 * Finds expense categories whose spend in the latest month exceeds the
 * average of all previous months by more than `threshold` (0.5 = +50%).
 * Months where a category had no spend count as zero.
 */
export function categorySpikes(rows: AggRow[], threshold = 0.5): CategorySpike[] {
  const months = [...new Set(rows.map((r) => r.month))].sort();
  if (months.length < 2) return [];
  const lastMonth = months[months.length - 1];
  const prevMonths = months.slice(0, -1);

  const perCategory = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (row.type !== 'EXPENSE') continue;
    const byMonth = perCategory.get(row.category) ?? new Map<string, number>();
    byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + row.totalCents);
    perCategory.set(row.category, byMonth);
  }

  const spikes: CategorySpike[] = [];
  for (const [category, byMonth] of perCategory) {
    const lastCents = byMonth.get(lastMonth) ?? 0;
    const avgPrev = prevMonths.reduce((sum, m) => sum + (byMonth.get(m) ?? 0), 0) / prevMonths.length;
    if (avgPrev > 0 && lastCents > avgPrev * (1 + threshold)) {
      spikes.push({
        category,
        month: lastMonth,
        lastCents,
        avgPrevCents: Math.round(avgPrev),
        changePct: round1(((lastCents - avgPrev) / avgPrev) * 100),
      });
    }
  }
  return spikes.sort((a, b) => b.changePct - a.changePct);
}
