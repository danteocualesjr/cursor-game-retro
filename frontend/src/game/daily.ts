/**
 * Daily-challenge level generator.
 *
 * Uses today's local-calendar date as a seed so every player on the
 * same date sees the same puzzle. The seed is the YYYYMMDD integer,
 * fed into a mulberry32 PRNG which we sample for placement decisions.
 *
 * The puzzle is always a single straight 6-tile path (3 rows wall /
 * floor / wall, 8 cols wide with walls on each side), with 3-5 gems
 * randomly placed on the path tiles. Goal kind is "collect-all" so
 * the player just needs to walk and pick up. This keeps every daily
 * solvable by the same simple template:
 *
 *   repeat(6) { move(1); if (here("gem")) { pickUp(); } }
 *
 * No backend call - generation is fully local.
 */

import type { LevelSpec } from "./grid";

export const DAILY_LEVEL_ID = 0;

/** YYYYMMDD as a single integer seed, derived from local time. */
export function dateSeed(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** Local-calendar YYYY-MM-DD string for display + persistence. */
export function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Mulberry32: tiny deterministic 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PATH_LEN = 6; // tiles the hero walks across
const PLAY_COLS = PATH_LEN; // playable columns on the path row
const TOTAL_COLS = PLAY_COLS + 2; // + 2 wall borders

/** Generate the level for the given local date. Pure - same date in
 *  same locale always produces the same LevelSpec. */
export function generateDailyLevel(date: Date = new Date()): LevelSpec {
  const seed = dateSeed(date);
  const rand = mulberry32(seed);

  const tiles: string[] = ["W", "H"];
  let gemCount = 0;
  for (let c = 0; c < PLAY_COLS - 1; c++) {
    // Roll a gem 55% of the time, but force at least 3 gems and at
    // most 5 across the row so every daily has a real shape.
    const r = rand();
    const remaining = PLAY_COLS - 1 - c;
    const need = Math.max(0, 3 - gemCount);
    const force = remaining <= need;
    const cap = gemCount >= 5;
    if (!cap && (force || r < 0.55)) {
      tiles.push("g");
      gemCount++;
    } else {
      tiles.push(".");
    }
  }
  tiles.push("W");

  const wallRow = Array(TOTAL_COLS).fill("W").join(" ");
  const middleRow = tiles.join(" ");
  const grid = [wallRow, middleRow, wallRow].join("\n");

  // Optimal: PATH_LEN moves + gemCount pickups = par
  const parSteps = PATH_LEN + gemCount;

  const intro = `Today's procedural puzzle (${dateStr(
    date,
  )}). Walk forward and grab every gem. Same puzzle for everyone today.`;

  const solution = `// Today's daily challenge!\nrepeat(${PATH_LEN}) {\n  move(1);\n  if (here("gem")) {\n    pickUp();\n  }\n}\n`;

  return {
    id: DAILY_LEVEL_ID,
    name: "Today's Quest",
    intro,
    starterCode: solution,
    allowedCommands: ["move", "turnLeft", "turnRight", "repeat", "pickUp", "if"],
    grid,
    goal: { kind: "collect-all" },
    parSteps,
    exampleSolution: solution,
  };
}
