/**
 * Tiny in-memory cache + per-session rate limiter.
 * Lives for the lifetime of the Node process. Plenty for a dev game.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  constructor(private ttlMs: number, private maxEntries = 256) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T) {
    if (this.map.size >= this.maxEntries) {
      // simple FIFO eviction: drop the first (oldest) key
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

export class SessionRateLimiter {
  private last = new Map<string, number>();
  constructor(private minIntervalMs: number) {}

  /** @returns ms until the session may call again, or 0 if allowed now. */
  check(sessionId: string): number {
    const now = Date.now();
    const prev = this.last.get(sessionId) ?? 0;
    const wait = this.minIntervalMs - (now - prev);
    if (wait <= 0) {
      this.last.set(sessionId, now);
      return 0;
    }
    return wait;
  }
}
