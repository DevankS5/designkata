/**
 * At most `limit` actions per key in any sliding window of `windowMs`.
 * ponytail: in memory and per process, which is right for one instance; move it
 * to a shared store such as Redis when there is more than one.
 */
export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Records an action and returns true, or returns false if the key is over its limit. */
  take(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((time) => now - time < this.windowMs);
    const allowed = recent.length < this.limit;
    if (allowed) recent.push(now);
    if (recent.length > 0) this.hits.set(key, recent);
    else this.hits.delete(key);
    return allowed;
  }
}
