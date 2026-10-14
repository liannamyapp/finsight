import { type AggRow, buildSummary, categorySpikes } from '../src/domain/analytics';
import { buildInsightsPrompt, parseInsightsJson, ruleBasedInsights } from '../src/domain/insights';
import { askClaude } from '../src/lib/llm';

const month = (m: string, income: number, payroll: number, marketing: number): AggRow[] => [
  { month: m, type: 'INCOME', category: 'Sales', totalCents: income },
  { month: m, type: 'EXPENSE', category: 'Payroll', totalCents: payroll },
  { month: m, type: 'EXPENSE', category: 'Marketing', totalCents: marketing },
];

describe('ruleBasedInsights', () => {
  it('returns a placeholder when there is no data', () => {
    const insights = ruleBasedInsights(buildSummary([]), []);
    expect(insights).toEqual([expect.objectContaining({ title: 'No data yet' })]);
  });

  it('flags losses, revenue drops, concentration and spikes', () => {
    const rows = [...month('2026-01', 100_000, 80_000, 10_000), ...month('2026-02', 50_000, 80_000, 40_000)];
    const titles = ruleBasedInsights(buildSummary(rows), categorySpikes(rows)).map((i) => i.title);

    expect(titles).toEqual([
      'Operating at a loss',
      'Revenue dropped month over month',
      'High cost concentration: Payroll',
      'Spending spike: Marketing',
    ]);
  });

  it('highlights a healthy, growing business', () => {
    const rows = [...month('2026-01', 100_000, 30_000, 5_000), ...month('2026-02', 130_000, 30_000, 5_000)];
    const insights = ruleBasedInsights(buildSummary(rows), categorySpikes(rows));
    expect(insights.filter((i) => i.level === 'positive').map((i) => i.title)).toEqual([
      'Healthy profit margin',
      'Revenue is growing',
    ]);
  });
});

describe('parseInsightsJson', () => {
  it('extracts a JSON array surrounded by prose or code fences', () => {
    const text = 'Here you go:\n```json\n[{"level":"warning","title":"Costs up","text":"Cloud spend grew."}]\n```';
    expect(parseInsightsJson(text)).toEqual([{ level: 'warning', title: 'Costs up', text: 'Cloud spend grew.' }]);
  });

  it.each([
    'no json here',
    '[{"level":"critical","title":"x","text":"y"}]',
    '[]',
    '[{"level": "info", broken',
  ])('returns null for invalid output: %s', (text) => {
    expect(parseInsightsJson(text)).toBeNull();
  });
});

describe('buildInsightsPrompt', () => {
  it('includes aggregated data in USD and asks for JSON only', () => {
    const rows = month('2026-01', 123_456, 50_000, 10_000);
    const prompt = buildInsightsPrompt(buildSummary(rows), []);
    expect(prompt).toContain('"revenue":1234.56');
    expect(prompt).toContain('Respond ONLY with a JSON array');
  });
});

describe('askClaude', () => {
  it('calls the Messages API and joins text blocks', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(JSON.stringify({ content: [{ type: 'text', text: '[1]' }, { type: 'text', text: '[2]' }] }), {
          status: 200,
        }),
    );

    const answer = await askClaude('hello', {
      apiKey: 'test-key',
      model: 'test-model',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(answer).toBe('[1]\n[2]');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('test-key');
    expect(JSON.parse(init.body as string)).toMatchObject({ model: 'test-model', messages: [{ role: 'user', content: 'hello' }] });
  });

  it('throws on non-2xx responses', async () => {
    const fetchImpl = jest.fn(async () => new Response('{}', { status: 529 }));
    await expect(
      askClaude('hi', { apiKey: 'k', model: 'm', fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow('529');
  });
});
