import { type AggRow, buildSummary, categorySpikes, pctChange } from '../src/domain/analytics';

const rows: AggRow[] = [
  { month: '2026-01', type: 'INCOME', category: 'Sales', totalCents: 100_000 },
  { month: '2026-01', type: 'EXPENSE', category: 'Payroll', totalCents: 50_000 },
  { month: '2026-01', type: 'EXPENSE', category: 'Marketing', totalCents: 10_000 },
  { month: '2026-02', type: 'INCOME', category: 'Sales', totalCents: 120_000 },
  { month: '2026-02', type: 'EXPENSE', category: 'Payroll', totalCents: 50_000 },
  { month: '2026-02', type: 'EXPENSE', category: 'Marketing', totalCents: 30_000 },
];

describe('pctChange', () => {
  it('computes rounded percentage change', () => {
    expect(pctChange(100, 120)).toBe(20);
    expect(pctChange(300, 200)).toBe(-33.3);
  });

  it('returns null when previous value is zero', () => {
    expect(pctChange(0, 50)).toBeNull();
  });
});

describe('buildSummary', () => {
  it('computes totals, margin and month-over-month change', () => {
    const s = buildSummary(rows);
    expect(s.totalIncomeCents).toBe(220_000);
    expect(s.totalExpenseCents).toBe(140_000);
    expect(s.netCents).toBe(80_000);
    expect(s.marginPct).toBe(36.4);
    expect(s.momIncomeChangePct).toBe(20);
  });

  it('builds a sorted monthly series', () => {
    const s = buildSummary([...rows].reverse());
    expect(s.monthly.map((m) => m.month)).toEqual(['2026-01', '2026-02']);
    expect(s.monthly[1]).toEqual({ month: '2026-02', incomeCents: 120_000, expenseCents: 80_000, netCents: 40_000 });
  });

  it('ranks expense categories with their share', () => {
    const s = buildSummary(rows);
    expect(s.topExpenseCategory).toBe('Payroll');
    expect(s.expenseByCategory).toEqual([
      { category: 'Payroll', amountCents: 100_000, sharePct: 71.4 },
      { category: 'Marketing', amountCents: 40_000, sharePct: 28.6 },
    ]);
  });

  it('handles an empty dataset', () => {
    const s = buildSummary([]);
    expect(s).toMatchObject({ netCents: 0, marginPct: null, momIncomeChangePct: null, topExpenseCategory: null });
    expect(s.monthly).toEqual([]);
  });
});

describe('categorySpikes', () => {
  it('detects categories that grew above the threshold in the latest month', () => {
    const spikes = categorySpikes(rows);
    expect(spikes).toEqual([
      { category: 'Marketing', month: '2026-02', lastCents: 30_000, avgPrevCents: 10_000, changePct: 200 },
    ]);
  });

  it('treats months without spend as zero and ignores income', () => {
    const data: AggRow[] = [
      { month: '2026-01', type: 'EXPENSE', category: 'Cloud', totalCents: 1_000 },
      { month: '2026-02', type: 'INCOME', category: 'Sales', totalCents: 5_000 },
      { month: '2026-03', type: 'EXPENSE', category: 'Cloud', totalCents: 1_000 },
      { month: '2026-03', type: 'INCOME', category: 'Sales', totalCents: 50_000 },
    ];
    // Average of previous months for Cloud is (1000 + 0) / 2 = 500 -> +100%
    expect(categorySpikes(data)).toEqual([
      { category: 'Cloud', month: '2026-03', lastCents: 1_000, avgPrevCents: 500, changePct: 100 },
    ]);
  });

  it('needs at least two months of data', () => {
    expect(categorySpikes(rows.filter((r) => r.month === '2026-01'))).toEqual([]);
  });
});
