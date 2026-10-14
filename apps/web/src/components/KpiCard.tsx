interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'negative';
}

export function KpiCard({ label, value, hint, tone = 'neutral' }: KpiCardProps) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value tone-${tone}`}>{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}
