import { useSummary } from '../api/hooks';
import { CategoryChart, MonthlyChart } from '../components/Charts';
import { InsightsPanel } from '../components/InsightsPanel';
import { KpiCard } from '../components/KpiCard';
import { formatMoney, formatPct } from '../lib/format';

export function DashboardPage() {
  const { data, isLoading, isError, error } = useSummary();

  if (isLoading) return <div className="placeholder">Loading dashboard…</div>;
  if (isError) return <p className="error">{error?.message}</p>;
  if (!data) return null;

  const empty = data.monthly.length === 0;

  return (
    <div className="stack">
      <h1>Dashboard</h1>

      <div className="kpi-grid">
        <KpiCard
          label="Revenue"
          value={formatMoney(data.totalIncomeCents)}
          hint={`MoM: ${formatPct(data.momIncomeChangePct, true)}`}
        />
        <KpiCard label="Expenses" value={formatMoney(data.totalExpenseCents)} hint={`Top: ${data.topExpenseCategory ?? '—'}`} />
        <KpiCard
          label="Net profit"
          value={formatMoney(data.netCents)}
          tone={data.netCents >= 0 ? 'positive' : 'negative'}
        />
        <KpiCard label="Net margin" value={formatPct(data.marginPct)} />
      </div>

      {empty ? (
        <div className="card placeholder">No transactions for this period yet. Add some on the Transactions page.</div>
      ) : (
        <div className="chart-grid">
          <section className="card">
            <h2>Revenue vs. expenses</h2>
            <MonthlyChart data={data.monthly} />
          </section>
          <section className="card">
            <h2>Expenses by category</h2>
            <CategoryChart data={data.expenseByCategory} />
          </section>
        </div>
      )}

      <InsightsPanel />
    </div>
  );
}
