import { Router } from 'express';
import { config } from '../../config';
import { buildSummary, categorySpikes } from '../../domain/analytics';
import { buildInsightsPrompt, type Insight, parseInsightsJson, ruleBasedInsights } from '../../domain/insights';
import { asyncHandler, type DateRange, dateRangeSchema } from '../../lib/http';
import { askClaude } from '../../lib/llm';
import { getUserId } from '../../middleware/auth';
import { getAggregates } from '../analytics/analytics.service';

export type InsightsResult = { source: 'llm' | 'rules'; insights: Insight[] };

export async function generateInsights(userId: string, range: DateRange): Promise<InsightsResult> {
  const rows = await getAggregates(userId, range);
  const summary = buildSummary(rows);
  const spikes = categorySpikes(rows);
  const fallback: InsightsResult = { source: 'rules', insights: ruleBasedInsights(summary, spikes) };

  if (!config.anthropicApiKey || summary.monthly.length === 0) return fallback;

  try {
    const answer = await askClaude(buildInsightsPrompt(summary, spikes), {
      apiKey: config.anthropicApiKey,
      model: config.anthropicModel,
    });
    const insights = parseInsightsJson(answer);
    if (insights) return { source: 'llm', insights };
    console.warn('LLM returned an unparseable answer, falling back to rules');
  } catch (err) {
    console.warn('LLM insights failed, falling back to rules:', (err as Error).message);
  }
  return fallback;
}

export const insightsRouter = Router();

insightsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const range = dateRangeSchema.parse(req.body ?? {});
    res.json(await generateInsights(getUserId(req), range));
  }),
);
