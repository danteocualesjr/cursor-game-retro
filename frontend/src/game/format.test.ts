import { describe, expect, it } from "vitest";
import { formatDsl } from "./format";

describe("formatDsl", () => {
  it("re-indents nested blocks with two-space steps", () => {
    const src = "repeat(3) {\nmove(1)\nturnLeft()\n}\n";
    expect(formatDsl(src)).toBe("repeat(3) {\n  move(1)\n  turnLeft()\n}\n");
  });

  it("handles deeply nested blocks", () => {
    const src = "repeat(2){\nrepeat(3){\nmove(1)\n}\n}\n";
    expect(formatDsl(src)).toBe(
      "repeat(2){\n  repeat(3){\n    move(1)\n  }\n}\n",
    );
  });

  it("trims trailing whitespace and collapses blank-line runs", () => {
    const src = "move(1)   \n\n\n\nturnLeft()\n";
    expect(formatDsl(src)).toBe("move(1)\n\nturnLeft()\n");
  });

  it("does not count braces inside string literals", () => {
    const src = 'if (sees("{")) {\nmove(1)\n}\n';
    expect(formatDsl(src)).toBe('if (sees("{")) {\n  move(1)\n}\n');
  });

  it("does not count braces inside line comments", () => {
    const src = "// this { brace } is fake\nmove(1)\n";
    expect(formatDsl(src)).toBe("// this { brace } is fake\nmove(1)\n");
  });

  it("places a leading close-brace at the parent depth", () => {
    const src = "repeat(2){\nmove(1)\n  }\n";
    expect(formatDsl(src)).toBe("repeat(2){\n  move(1)\n}\n");
  });

  it("returns empty string unchanged", () => {
    expect(formatDsl("")).toBe("");
  });

  it("never produces negative indent on stray closing brace", () => {
    const src = "}\nmove(1)\n";
    expect(formatDsl(src)).toBe("}\nmove(1)\n");
  });
});
