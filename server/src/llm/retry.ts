export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  isRetryable: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the operation, retrying retryable failures with exponential backoff and
 * jitter: base, 2x base, 4x base..., each plus up to half a base at random so
 * many clients do not retry in lockstep.
 */
export async function withRetry<T>(operation: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const wait = options.sleep ?? sleep;
  const random = options.random ?? Math.random;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= options.attempts || !options.isRetryable(error)) throw error;
      const delayMs = Math.round(options.baseDelayMs * 2 ** (attempt - 1) + random() * (options.baseDelayMs / 2));
      options.onRetry?.(error, attempt, delayMs);
      await wait(delayMs);
    }
  }
}
