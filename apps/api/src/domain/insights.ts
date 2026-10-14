import { z } from 'zod';
import type { CategorySpike, Summary } from './analytics';

export type InsightLevel = 'info' | 'warning' | 'positive';
export type Insight = { level: InsightLevel; title: string; text: string };

const usd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100,
  );

/** Deterministic insights used when no LLM is configured or the LLM call fails. */
export function ruleBasedInsights(summary: Summary, spikes: CategorySpike[]): Insight[] {
  if (summary.monthly.length === 0) {
    return [{ level: 'info', title: 'No data yet', text: 'Add or import transactions to see insights.' }];
  }

  const insights: Insight[] = [];
  const { marginPct, momIncomeChangePct, expenseByCategory } = summary;

  if (summary.netCents < 0) {
    const avgLoss = Math.abs(summary.netCents) / summary.monthly.length;
    insights.push({
      level: 'warning',
      title: 'Operating at a loss',
      text: `Expenses exceed revenue by ${usd(Math.abs(summary.netCents))} (≈${usd(avgLoss)} per month).`,
    });
  } else if (marginPct !== null && marginPct < 15) {
    insights.push({
      level: 'warning',
      title: 'Thin profit margin',
      text: `Net margin is ${marginPct}%. Review the largest cost categories to protect profitability.`,
    });
  } else if (marginPct !== null && marginPct >= 30) {
    insights.push({
      level: 'positive',
      title: 'Healthy profit margin',
      text: `Net margin is ${marginPct}%, which leaves room for growth investments.`,
    });
  }

  if (momIncomeChangePct !== null && momIncomeChangePct <= -10) {
    insights.push({
      level: 'warning',
      title: 'Revenue dropped month over month',
      text: `Revenue changed by ${momIncomeChangePct}% compared to the previous month.`,
    });
  } else if (momIncomeChangePct !== null && momIncomeChangePct >= 10) {
    insights.push({
      level: 'positive',
      title: 'Revenue is growing',
      text: `Revenue grew by ${momIncomeChangePct}% compared to the previous month.`,
    });
  }

  const top = expenseByCategory[0];
  if (top && top.sharePct >= 40) {
    insights.push({
      level: 'info',
      title: `High cost concentration: ${top.category}`,
      text: `${top.category} accounts for ${top.sharePct}% of all expenses.`,
    });
  }

  for (const spike of spikes.slice(0, 2)) {
    insights.push({
      level: 'warning',
      title: `Spending spike: ${spike.category}`,
      text: `${spike.category} spend in ${spike.month} was ${usd(spike.lastCents)}, +${spike.changePct}% vs. the average of previous months (${usd(spike.avgPrevCents)}).`,
    });
  }

  if (insights.length === 0) {
    insights.push({ level: 'info', title: 'Stable period', text: 'No significant changes detected.' });
  }
  return insights;
}

export function buildInsightsPrompt(summary: Summary, spikes: CategorySpike[]): string {
  const toUsd = (c: number) => Math.round(c) / 100;
  const data = {
    totals: {
      revenue: toUsd(summary.totalIncomeCents),
      expenses: toUsd(summary.totalExpenseCents),
      net: toUsd(summary.netCents),
      marginPct: summary.marginPct,
      momRevenueChangePct: summary.momIncomeChangePct,
    },
    monthly: summary.monthly.map((m) => ({
      month: m.month,
      revenue: toUsd(m.incomeCents),
      expenses: toUsd(m.expenseCents),
    })),
    expenseByCategory: summary.expenseByCategory.map((c) => ({
      category: c.category,
      amount: toUsd(c.amountCents),
      sharePct: c.sharePct,
    })),
    spikes: spikes.map((s) => ({ category: s.category, month: s.month, changePct: s.changePct })),
  };

  return [
    'You are a financial analyst for a small B2B company.',
    'Analyze the aggregated financial data below and give 3-5 concise, actionable insights.',
    'Use only the numbers provided; do not invent data.',
    'Respond ONLY with a JSON array, no prose, where each item is:',
    '{"level": "info" | "warning" | "positive", "title": string (max 60 chars), "text": string (max 240 chars)}',
    '',
    'DATA (amounts in USD):',
    JSON.stringify(data),
  ].join('\n');
}

const insightSchema = z.object({
  level: z.enum(['info', 'warning', 'positive']),
  title: z.string().min(1).max(120),
  text: z.string().min(1).max(500),
});

/** Extracts and validates the JSON array from an LLM response. Returns null if invalid. */
export function parseInsightsJson(text: string): Insight[] | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = z.array(insightSchema).min(1).safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data.slice(0, 6) : null;
  } catch {
    return null;
  }
}
