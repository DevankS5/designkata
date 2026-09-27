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

  it('forgets keys whose actions have all aged out', () => {
    const limiter = new RateLimiter(1, 1000);
    limiter.take('gone', 0);
    limiter.take('gone', 5000);
    expect((limiter as unknown as { hits: Map<string, number[]> }).hits.get('gone')).toEqual([5000]);
    const blocked = new RateLimiter(0, 1000);
    blocked.take('never', 0);
    expect((blocked as unknown as { hits: Map<string, number[]> }).hits.has('never')).toBe(false);
  });
});
