import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Creates a per-request temp directory containing the kid's code, the level
 * spec, and a tiny DSL.md cheat-sheet. The Cursor agent gets pointed at this
 * dir as its `local: { cwd }` so it can read all three files naturally.
 *
 * Caller MUST call `cleanup()` in a `finally`.
 */
export function createSandbox(input: {
  code: string;
  level: {
    id: number;
    name: string;
    intro: string;
    allowedCommands: string[];
  };
  errorLine?: number;
  errorMessage?: string;
}): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "codequest-"));

  writeFileSync(join(dir, "attempt.js"), input.code, "utf8");
  writeFileSync(
    join(dir, "level.json"),
    JSON.stringify(
      {
        id: input.level.id,
        name: input.level.name,
        objective: input.level.intro,
        allowedCommands: input.level.allowedCommands,
        lastError:
          input.errorLine !== undefined
            ? { line: input.errorLine, message: input.errorMessage ?? "" }
            : null,
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(join(dir, "DSL.md"), DSL_DOC, "utf8");

  return {
    dir,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // best effort
      }
    },
  };
}

const DSL_DOC = `# Codequest DSL

This is the tiny coding language a kid uses to control the hero in the puzzle
game. Read it before you give a hint.

## Commands

- \`move(n)\` walks the hero forward \`n\` tiles in the direction it's facing.
- \`turnLeft()\` / \`turnRight()\` rotate the hero 90 degrees.
- \`pickUp()\` picks up a gem on the tile the hero is standing on.
- \`push()\` pushes whatever is in the tile in front of the hero one tile forward.
  Pushing a crate onto a slime squishes the slime.
- \`attack()\` defeats a slime in the tile in front of the hero.
- \`wait()\` does nothing for a beat.

## Control flow

- \`repeat(n) { ... }\` runs the body \`n\` times.
- \`if (sees("X")) { ... } else { ... }\` checks the tile in front for X.
  X can be: \`gem\`, \`wall\`, \`crate\`, \`slime\`, \`switch\`, \`goal\`, \`open\`.
- \`if (here("X")) { ... }\` checks the tile the hero is currently standing on.
- \`while (sees("X")) { ... }\` loops while the sensor stays true.

## Goal types

- \`reach\` - hero must stand on the goal tile.
- \`collect-all\` - hero must pick up every gem.
- \`switches\` - all switches must have a crate on them.
- \`defeat-all\` - every slime must be gone.

## Files in this directory

- \`attempt.js\` - the kid's current code attempt.
- \`level.json\` - the level the kid is on, including allowedCommands and any lastError.
- \`DSL.md\` - this file.
`;
