import type { LlmClient, LlmRequest } from './llm-client.ts';

type Reply = string | Error | ((request: LlmRequest) => string);

/** A scripted model for tests: answers with the queued replies in order and records every request. */
export class FakeLlmClient implements LlmClient {
  readonly model = 'fake-model';
  readonly requests: LlmRequest[] = [];
  private readonly replies: Reply[];

  constructor(replies: Reply[] = []) {
    this.replies = [...replies];
  }

  /** Adds answers to the end of the script. */
  queue(...replies: Reply[]): this {
    this.replies.push(...replies);
    return this;
  }

  async complete(request: LlmRequest): Promise<string> {
    this.requests.push(request);
    const reply = this.replies.shift();
    if (reply === undefined) throw new Error('FakeLlmClient has no reply left.');
    if (reply instanceof Error) throw reply;
    return typeof reply === 'function' ? reply(request) : reply;
  }
}
