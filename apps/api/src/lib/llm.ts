export type LlmOptions = {
  apiKey: string;
  model: string;
  maxTokens?: number;
  timeoutMs?: number;
  /** Injected in tests to avoid real network calls. */
  fetchImpl?: typeof fetch;
};

type MessagesResponse = { content?: { type: string; text?: string }[] };

/** Sends a single-turn prompt to the Anthropic Messages API and returns the text output. */
export async function askClaude(prompt: string, opts: LlmOptions): Promise<string> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
  });

  if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`);
  const data = (await res.json()) as MessagesResponse;
  return (data.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n');
}
