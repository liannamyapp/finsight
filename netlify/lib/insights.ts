import Anthropic from '@anthropic-ai/sdk';
import { buildSummary, categorySpikes } from '../../apps/api/src/domain/analytics';
import {
  buildInsightsPrompt,
  type Insight,
  parseInsightsJson,
  ruleBasedInsights,
} from '../../apps/api/src/domain/insights';
import { getAggregates } from './analytics.js';
import type { DateRange } from './http.js';

export type InsightsResult = { source: 'llm' | 'rules'; insights: Insight[] };

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-5-5';

/** LLM insights via Netlify AI Gateway, with the deterministic rule engine as a safety net. */
export async function generateInsights(userId: string, range: DateRange): Promise<InsightsResult> {
  const rows = await getAggregates(userId, range);
  const summary = buildSummary(rows);
  const spikes = categorySpikes(rows);
  const fallback: InsightsResult = { source: 'rules', insights: ruleBasedInsights(summary, spikes) };

  if (summary.monthly.length === 0) return fallback;

  try {
    const anthropic = new Anthropic({ timeout: 20_000, maxRetries: 1 });
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildInsightsPrompt(summary, spikes) }],
    });
    const answer = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    const insights = parseInsightsJson(answer);
    if (insights) return { source: 'llm', insights };
    console.warn('LLM returned an unparseable answer, falling back to rules');
  } catch (err) {
    console.warn('LLM insights failed, falling back to rules:', (err as Error).message);
  }
  return fallback;
}
