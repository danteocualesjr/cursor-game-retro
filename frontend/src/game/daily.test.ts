import { describe, expect, it } from "vitest";
import {
  DAILY_LEVEL_ID,
  dateSeed,
  dateStr,
  generateDailyLevel,
  mulberry32,
} from "./daily";

describe("daily challenge generator", () => {
  it("dateSeed packs YYYYMMDD into a single integer", () => {
    expect(dateSeed(new Date(2026, 4, 5))).toBe(20260505);
    expect(dateSeed(new Date(2024, 0, 1))).toBe(20240101);
    expect(dateSeed(new Date(2099, 11, 31))).toBe(20991231);
  });

  it("dateStr renders YYYY-MM-DD with zero padding", () => {
    expect(dateStr(new Date(2026, 4, 5))).toBe("2026-05-05");
    expect(dateStr(new Date(2024, 0, 1))).toBe("2024-01-01");
  });

  it("mulberry32 is deterministic for the same seed", () => {
    const a = mulberry32(20260505);
    const b = mulberry32(20260505);
    for (let i = 0; i < 16; i++) {
      expect(a()).toBe(b());
    }
  });

  it("mulberry32 differs for different seeds", () => {
    const a = mulberry32(20260505);
    const b = mulberry32(20260506);
    expect(a()).not.toBe(b());
  });

  it("same date produces the same level", () => {
    const date = new Date(2026, 4, 5);
    const a = generateDailyLevel(date);
    const b = generateDailyLevel(date);
    expect(a.grid).toBe(b.grid);
    expect(a.parSteps).toBe(b.parSteps);
  });

  it("different dates produce different levels", () => {
    const a = generateDailyLevel(new Date(2026, 4, 5));
    const b = generateDailyLevel(new Date(2026, 4, 6));
    // Grids may rarely collide by chance, but seeds differ - run a
    // window of dates and ensure at least one differs.
    const grids = new Set([a.grid, b.grid]);
    grids.add(generateDailyLevel(new Date(2026, 4, 7)).grid);
    grids.add(generateDailyLevel(new Date(2026, 4, 8)).grid);
    expect(grids.size).toBeGreaterThan(1);
  });

  it("level id is the daily marker", () => {
    expect(generateDailyLevel(new Date(2026, 4, 5)).id).toBe(DAILY_LEVEL_ID);
    expect(DAILY_LEVEL_ID).toBe(0);
  });

  it("generated grid is always 3 rows wide and 8 cols", () => {
    const lvl = generateDailyLevel(new Date(2026, 4, 5));
    const rows = lvl.grid.split("\n");
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      // Tiles are space-separated, so split-and-filter to count.
      const tiles = r.split(/\s+/).filter((s) => s.length > 0);
      expect(tiles).toHaveLength(8);
    }
  });

  it("middle row starts with W H and ends with W", () => {
    const lvl = generateDailyLevel(new Date(2026, 4, 5));
    const middle = lvl.grid.split("\n")[1].split(/\s+/);
    expect(middle[0]).toBe("W");
    expect(middle[1]).toBe("H");
    expect(middle[middle.length - 1]).toBe("W");
  });

  it("middle row has between 3 and 5 gems inclusive", () => {
    // Sample many seeds to confirm the constraint.
    for (let day = 1; day <= 28; day++) {
      const lvl = generateDailyLevel(new Date(2026, 0, day));
      const middle = lvl.grid.split("\n")[1].split(/\s+/);
      const gems = middle.filter((t) => t === "g").length;
      expect(gems).toBeGreaterThanOrEqual(3);
      expect(gems).toBeLessThanOrEqual(5);
    }
  });

  it("parSteps equals 6 + gemCount", () => {
    const lvl = generateDailyLevel(new Date(2026, 4, 5));
    const middle = lvl.grid.split("\n")[1].split(/\s+/);
    const gems = middle.filter((t) => t === "g").length;
    expect(lvl.parSteps).toBe(6 + gems);
  });
});
