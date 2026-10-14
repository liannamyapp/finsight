const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdPrecise = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const formatMoney = (cents: number) => usd.format(cents / 100);
export const formatMoneyPrecise = (cents: number) => usdPrecise.format(cents / 100);
export const compact = (value: number) => `$${compactFmt.format(value)}`;

export const formatPct = (value: number | null, signed = false) => {
  if (value === null) return '—';
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

export const formatMonth = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};

export const today = () => new Date().toISOString().slice(0, 10);
