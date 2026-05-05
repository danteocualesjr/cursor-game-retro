import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  isSingleRepeat,
  loadUnlocks,
} from "./achievements";
import type { Stmt } from "./interpreter";

const STORAGE_KEY = "codequest:achievements";

// Vitest is configured for the node environment, so localStorage isn't
// available. Stub a minimal in-memory implementation so persistence
// tests have something to read/write.
beforeAll(() => {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = ls;
});

function clearLs() {
  localStorage.removeItem(STORAGE_KEY);
}

const REPEAT_ONLY: Stmt[] = [
  {
    kind: "repeat",
    count: 3,
    body: [{ kind: "call", name: "move", args: [{ kind: "number", value: 1 }], line: 2 }],
    line: 1,
  },
];

const TWO_STMTS: Stmt[] = [
  { kind: "call", name: "move", args: [{ kind: "number", value: 1 }], line: 1 },
  ...REPEAT_ONLY,
];

describe("achievements", () => {
  beforeEach(() => clearLs());
  afterEach(() => clearLs());

  it("isSingleRepeat detects a sole repeat block", () => {
    expect(isSingleRepeat(REPEAT_ONLY)).toBe(true);
    expect(isSingleRepeat(TWO_STMTS)).toBe(false);
    expect(isSingleRepeat([])).toBe(false);
  });

  it("First Step unlocks on solving level 1", () => {
    const unlocks = evaluateAchievements({
      levelId: 1,
      timeMs: 30_000,
      stars: 1,
      starsByLevel: { 1: 1 },
      program: TWO_STMTS,
    });
    expect(unlocks).toContain("first-step");
  });

  it("First Step does NOT fire for the daily (id 0)", () => {
    const unlocks = evaluateAchievements({
      levelId: 0,
      timeMs: 30_000,
      stars: 1,
      starsByLevel: { 0: 1 },
      program: TWO_STMTS,
    });
    expect(unlocks).not.toContain("first-step");
  });

  it("Star Collector unlocks on first 3-star solution", () => {
    const unlocks = evaluateAchievements({
      levelId: 2,
      timeMs: 8000,
      stars: 3,
      starsByLevel: { 2: 3 },
      program: TWO_STMTS,
    });
    expect(unlocks).toContain("star-collector");
  });

  it("Speed Demon unlocks for sub-5-second wins", () => {
    const unlocks = evaluateAchievements({
      levelId: 3,
      timeMs: 4500,
      stars: 1,
      starsByLevel: { 3: 1 },
      program: TWO_STMTS,
    });
    expect(unlocks).toContain("speed-demon");
  });

  it("Speed Demon does NOT fire when timer is 0", () => {
    const unlocks = evaluateAchievements({
      levelId: 3,
      timeMs: 0,
      stars: 1,
      starsByLevel: { 3: 1 },
      program: TWO_STMTS,
    });
    expect(unlocks).not.toContain("speed-demon");
  });

  it("Loop Master unlocks for single-repeat solutions", () => {
    const unlocks = evaluateAchievements({
      levelId: 6,
      timeMs: 30_000,
      stars: 2,
      starsByLevel: { 6: 2 },
      program: REPEAT_ONLY,
    });
    expect(unlocks).toContain("loop-master");
  });

  it("Loop Master does NOT fire for multi-statement solutions", () => {
    const unlocks = evaluateAchievements({
      levelId: 6,
      timeMs: 30_000,
      stars: 2,
      starsByLevel: { 6: 2 },
      program: TWO_STMTS,
    });
    expect(unlocks).not.toContain("loop-master");
  });

  it("Free Bird unlocks on solving level 8", () => {
    const unlocks = evaluateAchievements({
      levelId: 8,
      timeMs: 60_000,
      stars: 1,
      starsByLevel: { 8: 1 },
      program: TWO_STMTS,
    });
    expect(unlocks).toContain("free-bird");
  });

  it("Optimizer fires only when all regular levels have 3 stars", () => {
    const partial = evaluateAchievements({
      levelId: 1,
      timeMs: 1000,
      stars: 3,
      starsByLevel: { 1: 3 },
      program: TWO_STMTS,
    });
    expect(partial).not.toContain("optimizer");

    clearLs();
    const allMaxed: Record<number, number> = {};
    for (let i = 1; i <= 8; i++) allMaxed[i] = 3;
    const full = evaluateAchievements({
      levelId: 8,
      timeMs: 1000,
      stars: 3,
      starsByLevel: allMaxed,
      program: TWO_STMTS,
    });
    expect(full).toContain("optimizer");
  });

  it("does not re-unlock an achievement that was already earned", () => {
    const first = evaluateAchievements({
      levelId: 1,
      timeMs: 1000,
      stars: 1,
      starsByLevel: { 1: 1 },
      program: TWO_STMTS,
    });
    expect(first).toContain("first-step");
    const second = evaluateAchievements({
      levelId: 1,
      timeMs: 1000,
      stars: 1,
      starsByLevel: { 1: 1 },
      program: TWO_STMTS,
    });
    expect(second).not.toContain("first-step");
    // But the unlock is still recorded.
    expect(loadUnlocks()["first-step"]).toBeDefined();
  });

  it("ACHIEVEMENTS list has the expected six badges", () => {
    expect(ACHIEVEMENTS).toHaveLength(6);
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual([
      "first-step",
      "star-collector",
      "optimizer",
      "speed-demon",
      "loop-master",
      "free-bird",
    ]);
  });
});
