import { describe, expect, it } from 'vitest';
import { LlmError, type LlmRequest } from '../../src/llm/llm-client.ts';
import { OpenRouterClient } from '../../src/llm/openrouter-client.ts';
import { withRetry } from '../../src/llm/retry.ts';

const REQUEST: LlmRequest = {
  messages: [{ role: 'user', content: 'hi' }],
  schema: { name: 'answer', schema: { type: 'object' } },
};

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

function client(responses: (Response | Error)[], delays: number[] = []) {
  const calls: RequestInit[] = [];
  const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(init!);
    const next = responses.shift()!;
    if (next instanceof Error) throw next;
    return next;
  };
  const openRouter = new OpenRouterClient({
    apiKey: 'test-key',
    model: 'test/model',
    fetch: fetch as typeof globalThis.fetch,
    sleep: async (ms) => void delays.push(ms),
  });
  return { openRouter, calls };
}

describe('withRetry', () => {
  it('backs off exponentially with jitter and gives up after the last attempt', async () => {
    const delays: number[] = [];
    let calls = 0;
    const failing = withRetry(
      async () => {
        calls += 1;
        throw new LlmError('busy', true, 429);
      },
      { attempts: 3, baseDelayMs: 1000, isRetryable: () => true, sleep: async (ms) => void delays.push(ms), random: () => 0.5 },
    );

    await expect(failing).rejects.toThrow('busy');
    expect(calls).toBe(3);
    expect(delays).toEqual([1250, 2250]);
  });

  it('does not retry an error that will not go away', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error('bad request');
        },
        { attempts: 3, baseDelayMs: 1, isRetryable: () => false, sleep: async () => {} },
      ),
    ).rejects.toThrow('bad request');
    expect(calls).toBe(1);
  });
});

describe('OpenRouterClient', () => {
  it('asks for strict JSON-schema output and returns the answer text', async () => {
    const { openRouter, calls } = client([ok('{"a":1}')]);
    await expect(openRouter.complete(REQUEST)).resolves.toBe('{"a":1}');

    const body = JSON.parse(calls[0]!.body as string);
    expect(body).toMatchObject({
      model: 'test/model',
      temperature: 0,
      response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true } },
      provider: { require_parameters: true },
    });
    expect((calls[0]!.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
  });

  it('retries rate limits and server errors, then succeeds', async () => {
    const delays: number[] = [];
    const { openRouter } = client([new Response('slow down', { status: 429 }), new Response('oops', { status: 502 }), ok('{}')], delays);
    await expect(openRouter.complete(REQUEST)).resolves.toBe('{}');
    expect(delays).toHaveLength(2);
  });

  it('does not retry a bad request', async () => {
    const { openRouter, calls } = client([new Response('bad model', { status: 400 })]);
    await expect(openRouter.complete(REQUEST)).rejects.toMatchObject({ status: 400, retryable: false });
    expect(calls).toHaveLength(1);
  });

  it('treats network errors and empty answers as retryable', async () => {
    const { openRouter, calls } = client([new TypeError('fetch failed'), ok(''), ok('{"done":true}')]);
    await expect(openRouter.complete(REQUEST)).resolves.toBe('{"done":true}');
    expect(calls).toHaveLength(3);
  });

  it('reports an error object inside a 200 response', async () => {
    const { openRouter } = client([
      new Response(JSON.stringify({ error: { message: 'No provider supports json_schema', code: 404 } }), { status: 200 }),
    ]);
    await expect(openRouter.complete(REQUEST)).rejects.toThrow('No provider supports json_schema');
  });
});
