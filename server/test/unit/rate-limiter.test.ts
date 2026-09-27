import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../../src/app/rate-limiter.ts';

describe('RateLimiter', () => {
  it('allows the limit in a sliding window, then refuses until old actions age out', () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.take('l1', 0)).toBe(true);
    expect(limiter.take('l1', 100)).toBe(true);
    expect(limiter.take('l1', 200)).toBe(false);
    expect(limiter.take('l2', 200)).toBe(true);
    expect(limiter.take('l1', 1000)).toBe(true);
  });
});
