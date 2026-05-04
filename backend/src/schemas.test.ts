import { describe, expect, it } from "vitest";
import {
  explainBodySchema,
  formatZodErrors,
  hintBodySchema,
} from "./schemas.js";

const validHintBody = {
  levelId: 1,
  levelName: "First Steps",
  intro: "Walk to the goal.",
  allowedCommands: ["move"],
  code: "move(3);",
};

const validExplainBody = {
  levelId: 1,
  code: "move(3);",
  errorLine: 1,
  errorMessage: "Bonk! There's a wall in the way.",
};

describe("hintBodySchema", () => {
  it("accepts a minimal valid request", () => {
    const r = hintBodySchema.safeParse(validHintBody);
    expect(r.success).toBe(true);
  });

  it("accepts an optional lastError", () => {
    const r = hintBodySchema.safeParse({
      ...validHintBody,
      lastError: { line: 3, message: "wall" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-integer level id", () => {
    const r = hintBodySchema.safeParse({ ...validHintBody, levelId: 1.5 });
    expect(r.success).toBe(false);
  });

  it("rejects a level id outside the allowed range", () => {
    const r = hintBodySchema.safeParse({ ...validHintBody, levelId: 0 });
    expect(r.success).toBe(false);
    const r2 = hintBodySchema.safeParse({ ...validHintBody, levelId: 1000 });
    expect(r2.success).toBe(false);
  });

  it("rejects an empty levelName", () => {
    const r = hintBodySchema.safeParse({ ...validHintBody, levelName: "" });
    expect(r.success).toBe(false);
  });

  it("rejects code over the 10KB cap", () => {
    const r = hintBodySchema.safeParse({
      ...validHintBody,
      code: "a".repeat(10_001),
    });
    expect(r.success).toBe(false);
  });

  it("rejects more than 40 allowedCommands", () => {
    const r = hintBodySchema.safeParse({
      ...validHintBody,
      allowedCommands: Array.from({ length: 41 }, (_, i) => `cmd${i}`),
    });
    expect(r.success).toBe(false);
  });

  it("rejects an oversized error message in lastError", () => {
    const r = hintBodySchema.safeParse({
      ...validHintBody,
      lastError: { line: 1, message: "a".repeat(2_001) },
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-positive errorLine in lastError", () => {
    const r = hintBodySchema.safeParse({
      ...validHintBody,
      lastError: { line: 0, message: "x" },
    });
    expect(r.success).toBe(false);
  });

  it("strips unknown top-level fields by default", () => {
    const r = hintBodySchema.safeParse({
      ...validHintBody,
      // Zod object schemas strip unknown keys by default.
      maliciousField: "drop table",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>).maliciousField).toBeUndefined();
    }
  });
});

describe("explainBodySchema", () => {
  it("accepts a valid request", () => {
    const r = explainBodySchema.safeParse(validExplainBody);
    expect(r.success).toBe(true);
  });

  it("requires errorLine and errorMessage to be present", () => {
    const r = explainBodySchema.safeParse({
      levelId: 1,
      code: "x",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty errorMessage", () => {
    const r = explainBodySchema.safeParse({
      ...validExplainBody,
      errorMessage: "",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an out-of-range errorLine", () => {
    const r = explainBodySchema.safeParse({
      ...validExplainBody,
      errorLine: -1,
    });
    expect(r.success).toBe(false);
  });
});

describe("formatZodErrors", () => {
  it("produces a human-readable, dot-pathed list", () => {
    const r = hintBodySchema.safeParse({
      ...validHintBody,
      levelId: -1,
      lastError: { line: 0, message: "" },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const out = formatZodErrors(r.error);
      // Path components for the failing fields should each appear in the
      // output, separated by ';'.
      expect(out).toContain("levelId");
      expect(out).toContain("lastError.line");
      expect(out).toContain(";");
    }
  });

  it("uses (root) for path-less errors", () => {
    const r = hintBodySchema.safeParse("not even an object");
    expect(r.success).toBe(false);
    if (!r.success) {
      const out = formatZodErrors(r.error);
      expect(out).toContain("(root)");
    }
  });
});
