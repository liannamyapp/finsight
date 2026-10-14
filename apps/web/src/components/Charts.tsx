import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CategoryPoint, MonthlyPoint } from '../api/types';
import { compact, formatMoney, formatMonth } from '../lib/format';

const INCOME_COLOR = '#0f9d76';
const EXPENSE_COLOR = '#e4572e';
const CATEGORY_COLORS = ['#3b5bdb', '#0f9d76', '#e4572e', '#f2a541', '#7048e8', '#1098ad', '#868e96'];

export function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  const chartData = data.map((p) => ({
    month: formatMonth(p.month),
    Revenue: p.incomeCents / 100,
    Expenses: p.expenseCents / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9ecef" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickFormatter={(v) => compact(Number(v))} tickLine={false} axisLine={false} fontSize={12} width={56} />
        <Tooltip formatter={(v) => formatMoney(Number(v) * 100)} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend iconType="circle" />
        <Bar dataKey="Revenue" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Expenses" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryChart({ data }: { data: CategoryPoint[] }) {
  // Keep the chart readable: top 6 categories + "Other".
  const top = data.slice(0, 6);
  const rest = data.slice(6).reduce((sum, c) => sum + c.amountCents, 0);
  const chartData = [
    ...top.map((c) => ({ name: c.category, value: c.amountCents / 100 })),
    ...(rest > 0 ? [{ name: 'Other', value: rest / 100 }] : []),
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={2}>
          {chartData.map((entry, i) => (
            <Cell key={entry.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatMoney(Number(v) * 100)} />
        <Legend iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}
