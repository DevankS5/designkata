export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  /** JSON schema the answer must follow. */
  schema: { name: string; schema: Record<string, unknown> };
  /** Defaults to 0: the same design should get the same review. */
  temperature?: number;
}

/** A language model that answers in text. The provider (OpenRouter today) is an implementation detail. */
export interface LlmClient {
  readonly model: string;
  complete(request: LlmRequest): Promise<string>;
}

export class LlmError extends Error {
  /** True for failures worth trying again: timeouts, rate limits, provider outages. */
  readonly retryable: boolean;
  readonly status: number | undefined;

  constructor(message: string, retryable: boolean, status?: number) {
    super(message);
    this.name = 'LlmError';
    this.retryable = retryable;
    this.status = status;
  }
}
