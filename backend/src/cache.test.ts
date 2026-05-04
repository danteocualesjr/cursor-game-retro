import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionRateLimiter, TtlCache } from "./cache.js";

describe("TtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for a missing key", () => {
    const c = new TtlCache<string>(1000);
    expect(c.get("nope")).toBeUndefined();
  });

  it("returns a stored value while it's still fresh", () => {
    const c = new TtlCache<string>(1000);
    c.set("k", "hello");
    expect(c.get("k")).toBe("hello");
    vi.advanceTimersByTime(999);
    expect(c.get("k")).toBe("hello");
  });

  it("expires a value once its TTL has elapsed", () => {
    const c = new TtlCache<string>(1000);
    c.set("k", "hello");
    vi.advanceTimersByTime(1001);
    expect(c.get("k")).toBeUndefined();
  });

  it("re-setting a key extends its TTL", () => {
    const c = new TtlCache<string>(1000);
    c.set("k", "v1");
    vi.advanceTimersByTime(800);
    c.set("k", "v2");
    vi.advanceTimersByTime(800);
    // Total elapsed: 1600ms, but k was reset at t=800 so still fresh until t=1800.
    expect(c.get("k")).toBe("v2");
  });

  it("evicts the oldest entry when maxEntries is exceeded", () => {
    const c = new TtlCache<number>(60_000, 3);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    c.set("d", 4); // should evict "a"
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
    expect(c.get("d")).toBe(4);
  });

  it("eviction continues to work past the cap on repeated overflow", () => {
    const c = new TtlCache<number>(60_000, 2);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3); // evicts a
    c.set("d", 4); // evicts b
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBeUndefined();
    expect(c.get("c")).toBe(3);
    expect(c.get("d")).toBe(4);
  });

  it("works with structured (object) values", () => {
    interface Hint {
      text: string;
      source: string;
    }
    const c = new TtlCache<Hint>(1000);
    c.set("k", { text: "hi", source: "fallback" });
    expect(c.get("k")).toEqual({ text: "hi", source: "fallback" });
  });
});

describe("SessionRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first call from a session", () => {
    const rl = new SessionRateLimiter(5_000);
    expect(rl.check("alice")).toBe(0);
  });

  it("blocks a second call inside the window with the remaining wait", () => {
    const rl = new SessionRateLimiter(5_000);
    expect(rl.check("alice")).toBe(0);
    vi.advanceTimersByTime(2_000);
    const wait = rl.check("alice");
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(3_000);
  });

  it("allows the call again once the window has elapsed", () => {
    const rl = new SessionRateLimiter(5_000);
    rl.check("alice");
    vi.advanceTimersByTime(5_001);
    expect(rl.check("alice")).toBe(0);
  });

  it("tracks each session independently", () => {
    const rl = new SessionRateLimiter(5_000);
    expect(rl.check("alice")).toBe(0);
    expect(rl.check("bob")).toBe(0);
    vi.advanceTimersByTime(1_000);
    expect(rl.check("alice")).toBeGreaterThan(0);
    expect(rl.check("bob")).toBeGreaterThan(0);
  });

  it("only updates the timestamp when the call is actually allowed", () => {
    // This guards against a regression where blocked calls would push the
    // timestamp forward and effectively reset the rate-limit window.
    const rl = new SessionRateLimiter(5_000);
    rl.check("alice"); // t=0, allowed
    vi.advanceTimersByTime(1_000);
    rl.check("alice"); // t=1000, blocked
    vi.advanceTimersByTime(1_000);
    rl.check("alice"); // t=2000, blocked
    vi.advanceTimersByTime(3_001);
    // Total elapsed since the only allowed call is 5,001ms, so the next
    // call MUST be allowed regardless of the intervening blocked checks.
    expect(rl.check("alice")).toBe(0);
  });
});
