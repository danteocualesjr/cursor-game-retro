/**
 * Tiny achievement system.
 *
 * Definitions live in this module. Unlock state persists in
 * localStorage:codequest:achievements as Record<id, isoDateString>.
 * onWin() in main.ts calls evaluateAchievements() with a context
 * snapshot - the function returns any newly-unlocked achievement
 * IDs so the UI can fire toasts for each.
 *
 * The "Loop Master" achievement parses the player's code AST to
 * verify the program is exactly one top-level repeat() block, so
 * we accept the parsed Stmt[] in the context rather than the raw
 * source.
 */

import type { Stmt } from "./interpreter";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
}

export const ACHIEVEMENTS: ReadonlyArray<AchievementDef> = [
  {
    id: "first-step",
    name: "First Step",
    description: "Solve Level 1.",
  },
  {
    id: "star-collector",
    name: "Star Collector",
    description: "Earn your first 3-star solution.",
  },
  {
    id: "optimizer",
    name: "Optimizer",
    description: "Earn 3 stars on every regular level.",
  },
  {
    id: "speed-demon",
    name: "Speed Demon",
    description: "Solve any level in under 5 seconds.",
  },
  {
    id: "loop-master",
    name: "Loop Master",
    description: "Solve a level using only a single repeat() statement.",
  },
  {
    id: "free-bird",
    name: "Free Bird",
    description: "Solve Free Play (Level 8).",
  },
];

const STORAGE_KEY = "codequest:achievements";
/** IDs of the regular (non-daily) levels used for "Optimizer". */
const REGULAR_LEVEL_IDS = [1, 2, 3, 4, 5, 6, 7, 8];

export type AchievementUnlocks = Record<string, string>;

export function loadUnlocks(): AchievementUnlocks {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AchievementUnlocks;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveUnlocks(u: AchievementUnlocks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  } catch {
    /* ignore */
  }
}

export interface WinContext {
  /** Level the player just solved. */
  levelId: number;
  /** Time in milliseconds it took. */
  timeMs: number;
  /** Stars earned this run (1-3). */
  stars: number;
  /** Best star count per level *after* this win is recorded. */
  starsByLevel: Record<number, number>;
  /** Parsed program the player just ran. */
  program: Stmt[];
}

/** Returns true if a Stmt[] is exactly one top-level repeat block. */
export function isSingleRepeat(program: Stmt[]): boolean {
  return program.length === 1 && program[0].kind === "repeat";
}

/** Run all checks against `ctx`, persist any unlocks, and return the
 *  list of newly-unlocked achievement IDs. */
export function evaluateAchievements(ctx: WinContext): string[] {
  const unlocks = loadUnlocks();
  const newlyUnlocked: string[] = [];

  const tryUnlock = (id: string) => {
    if (unlocks[id]) return;
    unlocks[id] = new Date().toISOString();
    newlyUnlocked.push(id);
  };

  // First Step: solved level 1 (id 1, not daily 0).
  if (ctx.levelId === 1) {
    tryUnlock("first-step");
  }

  // Star Collector: earned first 3-star solution.
  if (ctx.stars === 3) {
    tryUnlock("star-collector");
  }

  // Speed Demon: under 5 seconds on any level.
  if (ctx.timeMs > 0 && ctx.timeMs < 5_000) {
    tryUnlock("speed-demon");
  }

  // Loop Master: program is one top-level repeat statement, nothing else.
  if (isSingleRepeat(ctx.program)) {
    tryUnlock("loop-master");
  }

  // Free Bird: solved the Free Play level (id 8).
  if (ctx.levelId === 8) {
    tryUnlock("free-bird");
  }

  // Optimizer: 3 stars on every regular level. Use the post-win
  // starsByLevel so the level just solved is included.
  const allMaxed = REGULAR_LEVEL_IDS.every((id) => (ctx.starsByLevel[id] ?? 0) >= 3);
  if (allMaxed) {
    tryUnlock("optimizer");
  }

  if (newlyUnlocked.length > 0) saveUnlocks(unlocks);
  return newlyUnlocked;
}

/** Look up an achievement definition by id. */
export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
