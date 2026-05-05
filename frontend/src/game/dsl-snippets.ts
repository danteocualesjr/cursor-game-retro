/**
 * Source of truth for the friendly snippets we insert when a player picks
 * a command from autocomplete or clicks a command chip in the HUD.
 * cursorOffsetFromEnd is the number of characters to back up from the end
 * of `apply` so the cursor lands inside the parens or block body.
 */

export interface DslSnippet {
  label: string;
  detail: string;
  info: string;
  apply: string;
  cursorOffsetFromEnd?: number;
  /** "function" or "keyword" - used to color autocomplete chips. */
  kind: "function" | "keyword" | "sensor";
}

export const DSL_SNIPPETS: ReadonlyArray<DslSnippet> = [
  { label: "move", kind: "function", detail: "move(n)", info: "Walk n tiles forward.", apply: "move(1)", cursorOffsetFromEnd: 1 },
  { label: "turnLeft", kind: "function", detail: "turnLeft()", info: "Rotate 90 degrees counter-clockwise.", apply: "turnLeft()" },
  { label: "turnRight", kind: "function", detail: "turnRight()", info: "Rotate 90 degrees clockwise.", apply: "turnRight()" },
  { label: "pickUp", kind: "function", detail: "pickUp()", info: "Pick up a gem on the hero's tile.", apply: "pickUp()" },
  { label: "push", kind: "function", detail: "push()", info: "Shove the tile in front by one.", apply: "push()" },
  { label: "attack", kind: "function", detail: "attack()", info: "Hit a slime in front of the hero.", apply: "attack()" },
  { label: "wait", kind: "function", detail: "wait()", info: "Do nothing for a beat.", apply: "wait()" },
  {
    label: "repeat",
    kind: "keyword",
    detail: "repeat(n) { ... }",
    info: "Run the body n times.",
    apply: "repeat(3) {\n  \n}",
    cursorOffsetFromEnd: 3,
  },
  {
    label: "if",
    kind: "keyword",
    detail: 'if (sees("X")) { ... }',
    info: 'Run the body when the sensor is true. X = gem|wall|crate|slime|switch|goal|open',
    apply: 'if (sees("gem")) {\n  \n}',
    cursorOffsetFromEnd: 3,
  },
  {
    label: "while",
    kind: "keyword",
    detail: 'while (sees("X")) { ... }',
    info: "Loop while the sensor stays true.",
    apply: 'while (sees("open")) {\n  \n}',
    cursorOffsetFromEnd: 3,
  },
  { label: "sees", kind: "sensor", detail: 'sees("X")', info: "True if X is in the tile in front of the hero.", apply: 'sees("gem")' },
  { label: "here", kind: "sensor", detail: 'here("X")', info: "True if X is on the tile the hero is standing on.", apply: 'here("gem")' },
];

/** Lookup helper. */
export function snippetFor(name: string): DslSnippet | undefined {
  return DSL_SNIPPETS.find((s) => s.label === name);
}
