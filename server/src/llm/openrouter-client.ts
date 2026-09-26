import { LlmError, type LlmClient, type LlmRequest } from './llm-client.ts';
import { withRetry } from './retry.ts';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  attempts?: number;
  baseDelayMs?: number;
  /** Reasoning effort for models that think before answering, or "off". */
  reasoning?: 'off' | 'low' | 'medium' | 'high';
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** Talks to OpenRouter's chat completions API with strict JSON-schema output, a timeout and retries. */
export class OpenRouterClient implements LlmClient {
  readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly attempts: number;
  private readonly baseDelayMs: number;
  private readonly reasoning: NonNullable<OpenRouterOptions['reasoning']>;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: ((ms: number) => Promise<void>) | undefined;

  constructor(options: OpenRouterOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.attempts = options.attempts ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 1_000;
    this.reasoning = options.reasoning ?? 'low';
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep;
  }

  complete(request: LlmRequest): Promise<string> {
    return withRetry(() => this.completeOnce(request), {
      attempts: this.attempts,
      baseDelayMs: this.baseDelayMs,
      isRetryable: (error) => error instanceof LlmError && error.retryable,
      ...(this.sleep ? { sleep: this.sleep } : {}),
    });
  }

  private async completeOnce(request: LlmRequest): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'DesignKata',
        },
        body: JSON.stringify(this.body(request)),
        signal: controller.signal,
      });
    } catch (error) {
      const reason = controller.signal.aborted ? `timed out after ${this.timeoutMs} ms` : String(error);
      throw new LlmError(`Could not reach the AI reviewer: ${reason}`, true);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new LlmError(`The AI reviewer returned HTTP ${response.status}. ${detail}`.trim(), retryable, response.status);
    }

    const data = (await response.json()) as {
      error?: { message?: string; code?: number };
      choices?: { message?: { content?: string | null } }[];
    };
    if (data.error) {
      const code = data.error.code ?? 500;
      throw new LlmError(`The AI reviewer failed: ${data.error.message ?? 'unknown error'}`, code === 429 || code >= 500, code);
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content?.trim()) throw new LlmError('The AI reviewer returned an empty answer.', true);
    return content;
  }

  private body(request: LlmRequest): Record<string, unknown> {
    return {
      model: this.model,
      messages: request.messages,
      temperature: 0,
      seed: 7,
      response_format: {
        type: 'json_schema',
        json_schema: { name: request.schema.name, strict: true, schema: request.schema.schema },
      },
      // Only route to providers that honour the JSON schema.
      provider: { require_parameters: true },
      ...(this.reasoning === 'off'
        ? { reasoning: { enabled: false } }
        : { reasoning: { effort: this.reasoning, exclude: true } }),
    };
  }
}
