/**
 * Tiny brace-aware indenter for the in-game DSL.
 *
 * The DSL only nests on '{' / '}', never on parens, so a single-pass walk
 * of each line is enough. Strings and // comments are preserved verbatim
 * so a literal '{' in a comment doesn't bump indentation.
 *
 * Pure function so it's easy to unit-test.
 */

const INDENT = "  ";

/** Strip everything inside string literals or after a `//` so brace
 *  counting only looks at real syntax. */
function stripLiteralsAndComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "/" && src[i + 1] === "/") {
      // Drop the rest of the line (we still want the newline if there is one).
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\n") break;
        i++;
      }
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function countNet(line: string): { opens: number; closes: number } {
  const stripped = stripLiteralsAndComments(line);
  let opens = 0;
  let closes = 0;
  for (const c of stripped) {
    if (c === "{") opens++;
    else if (c === "}") closes++;
  }
  return { opens, closes };
}

/** Returns true if the visible (non-comment, non-whitespace) portion of
 *  the line begins with `}`. Such lines outdent on their own line. */
function startsWithCloseBrace(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("}");
}

export function formatDsl(src: string): string {
  // Normalize newlines, preserve content otherwise.
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let depth = 0;
  let blankRun = 0;

  for (const raw of lines) {
    const trimmed = raw.trim();

    // Collapse runs of blank lines to at most one.
    if (trimmed === "") {
      blankRun++;
      if (blankRun <= 1) out.push("");
      continue;
    }
    blankRun = 0;

    const { opens, closes } = countNet(trimmed);

    // A line that *starts* with `}` should render at the parent's depth,
    // not the current (deeper) depth.
    const lineDepth = startsWithCloseBrace(trimmed)
      ? Math.max(0, depth - 1)
      : depth;

    out.push(INDENT.repeat(lineDepth) + trimmed);
    depth = Math.max(0, depth + opens - closes);
  }

  // Drop trailing blanks and ensure exactly one final newline (only when
  // there's any content - empty input stays empty).
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  if (out.length === 0) return "";
  return out.join("\n") + "\n";
}
