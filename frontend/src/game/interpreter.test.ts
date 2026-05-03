import { describe, expect, it } from "vitest";
import { execute, parse, ParseError } from "./interpreter";
import type { Engine } from "./engine";
import { buildWorld, type LevelSpec, type World } from "./grid";

/** Minimal stub of Engine that resolves every animation immediately. */
function stubEngine(): Engine {
  const noop = () => Promise.resolve();
  return {
    animateMove: noop,
    animateTurn: noop,
    animateBump: noop,
    animatePickup: noop,
    animatePush: noop,
    animateAttack: noop,
    animateDefeat: noop,
    animatePause: noop,
    setSpeed: () => undefined,
    setWorld: () => undefined,
  } as unknown as Engine;
}

function level(grid: string, goal: LevelSpec["goal"], opts: Partial<LevelSpec> = {}): LevelSpec {
  return {
    id: 99,
    name: "test",
    intro: "test",
    starterCode: "",
    allowedCommands: [
      "move",
      "turnLeft",
      "turnRight",
      "pickUp",
      "push",
      "attack",
      "repeat",
      "if",
      "while",
    ],
    grid,
    goal,
    parSteps: 1,
    ...opts,
  };
}

async function run(code: string, world: World) {
  const ctrl = new AbortController();
  const program = parse(code);
  return execute(program, {
    world,
    engine: stubEngine(),
    signal: ctrl.signal,
  });
}

// ----------------------------- PARSER -----------------------------

describe("parse", () => {
  it("parses a simple program with semicolons and comments", () => {
    const ast = parse("// hello\nmove(3);\nturnRight();");
    expect(ast).toHaveLength(2);
    expect(ast[0]).toMatchObject({ kind: "call", name: "move", line: 2 });
    expect(ast[1]).toMatchObject({ kind: "call", name: "turnRight", line: 3 });
  });

  it("parses repeat/if/while bodies", () => {
    const ast = parse(
      [
        "repeat(2) {",
        '  if (sees("gem")) { pickUp(); } else { move(1); }',
        "}",
        'while (here("gem")) { pickUp(); }',
      ].join("\n"),
    );
    expect(ast[0]).toMatchObject({ kind: "repeat", count: 2 });
    expect(ast[1]).toMatchObject({ kind: "while", sensorName: "here", sensorArg: "gem" });
  });

  it("rejects an unknown command with a kid-friendly line number", () => {
    expect(() => parse("dance();")).toThrowError(ParseError);
    try {
      parse("dance();");
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect((e as ParseError).line).toBe(1);
    }
  });

  it("rejects an unclosed string", () => {
    expect(() => parse('if (sees("gem) { }')).toThrow();
  });

  it("rejects a missing closing brace", () => {
    expect(() => parse("repeat(2) { move(1); ")).toThrow();
  });

  it("rejects an unknown sensor", () => {
    expect(() => parse('if (smells("gem")) { }')).toThrow(/sensor/);
  });
});

// ----------------------------- INTERPRETER -----------------------------

describe("execute", () => {
  it("walks straight and reaches the goal", async () => {
    const world = buildWorld(
      level(["W W W W W", "W H . . G W", "W W W W W"].join("\n"), {
        kind: "reach",
        x: 4,
        y: 1,
      }),
    );
    const res = await run("move(3);", world);
    expect(res.win).toBe(true);
    expect(world.hero.x).toBe(4);
    expect(world.hero.y).toBe(1);
  });

  it("bonks into a wall and reports the source line", async () => {
    const world = buildWorld(
      level(["W W W W", "W H W .", "W W W W"].join("\n"), {
        kind: "reach",
        x: 99,
        y: 99,
      }),
    );
    const res = await run("\n\nmove(2);", world);
    expect(res.win).toBe(false);
    expect(res.errorLine).toBe(3);
    expect(res.message).toMatch(/wall/i);
  });

  it("turns right and walks the corner", async () => {
    const world = buildWorld(
      level(
        ["W W W W", "W H . W", "W . . W", "W . G W", "W W W W"].join("\n"),
        { kind: "reach", x: 2, y: 3 },
      ),
    );
    const res = await run("move(1); turnRight(); move(2);", world);
    expect(res.win).toBe(true);
  });

  it("repeat() runs the body N times", async () => {
    const world = buildWorld(
      level(["W W W W W W", "W H . . . G W", "W W W W W W W"].join("\n"), {
        kind: "reach",
        x: 5,
        y: 1,
      }),
    );
    const res = await run("repeat(4) { move(1); }", world);
    expect(res.win).toBe(true);
  });

  it("if(here(\"gem\")) only picks up when standing on a gem", async () => {
    const world = buildWorld(
      level(["W W W W", "W H g W", "W W W W"].join("\n"), {
        kind: "collect-all",
      }),
    );
    const res = await run(
      [
        'if (here("gem")) { pickUp(); }', // on starting tile, no gem - does nothing
        "move(1);",
        'if (here("gem")) { pickUp(); }', // now standing on the gem
      ].join("\n"),
      world,
    );
    expect(res.win).toBe(true);
    expect(world.gems).toHaveLength(0);
  });

  it("rejects pickUp() with no gem under the hero", async () => {
    const world = buildWorld(
      level(["W W W", "W H W", "W W W"].join("\n"), { kind: "collect-all" }),
    );
    const res = await run("pickUp();", world);
    expect(res.win).toBe(false);
    expect(res.errorLine).toBe(1);
    expect(res.message).toMatch(/pick up|gem/i);
  });

  it("push() shoves a crate onto a switch and triggers the goal", async () => {
    const world = buildWorld(
      level(["W W W W W", "W H c s W", "W W W W W"].join("\n"), {
        kind: "switches",
      }),
    );
    const res = await run("push();", world);
    expect(res.win).toBe(true);
    expect(world.crates[0]).toMatchObject({ x: 3, y: 1 });
    expect(world.switches[0].active).toBe(true);
  });

  it("push() squishes a slime when the crate lands on it", async () => {
    const world = buildWorld(
      level(["W W W W W", "W H c m W", "W W W W W"].join("\n"), {
        kind: "defeat-all",
      }),
    );
    const res = await run("push();", world);
    expect(res.win).toBe(true);
    expect(world.slimes).toHaveLength(0);
  });

  it("attack() defeats a slime in front", async () => {
    const world = buildWorld(
      level(["W W W W", "W H m W", "W W W W"].join("\n"), { kind: "defeat-all" }),
    );
    const res = await run("attack();", world);
    expect(res.win).toBe(true);
    expect(world.slimes).toHaveLength(0);
  });

  it('while(sees("open")) walks to the wall and stops', async () => {
    const world = buildWorld(
      level(["W W W W W W", "W H . . . W", "W W W W W W"].join("\n"), {
        kind: "reach",
        x: 4,
        y: 1,
      }),
    );
    const res = await run('while (sees("open")) { move(1); }', world);
    expect(res.win).toBe(true);
    expect(world.hero.x).toBe(4);
  });

  it("explodes safely when an infinite loop runs past the step cap", async () => {
    // 2x100 corridor; while loop never terminates because no wall in front.
    const grid = ["W " + ". ".repeat(200) + "W", "W H " + ". ".repeat(199) + "W"];
    const world = buildWorld(level(grid.join("\n"), { kind: "reach", x: 999, y: 999 }));
    const res = await run('while (sees("open")) { move(1); }', world);
    expect(res.win).toBe(false);
    expect(res.message).toMatch(/lot of steps|infinite|forever|without stopping/i);
  });

  it("aborts cleanly when the AbortSignal fires before run", async () => {
    const world = buildWorld(
      level(["W W W W", "W H . W", "W W W W"].join("\n"), {
        kind: "reach",
        x: 99,
        y: 99,
      }),
    );
    const ctrl = new AbortController();
    ctrl.abort();
    const res = await execute(parse("move(1);"), {
      world,
      engine: stubEngine(),
      signal: ctrl.signal,
    });
    expect(res.win).toBe(false);
    expect(res.message).toMatch(/stop/i);
  });

  it("aborts mid-run inside a long move(n) without finishing the walk", async () => {
    const world = buildWorld(
      level(
        ["W W W W W W W W W W", "W H . . . . . . . W", "W W W W W W W W W W"].join("\n"),
        { kind: "reach", x: 8, y: 1 },
      ),
    );
    const ctrl = new AbortController();
    let stepCount = 0;
    // Custom engine that aborts the signal after the second step's animation.
    const aborter: Engine = {
      animateMove: () => {
        stepCount++;
        if (stepCount === 2) ctrl.abort();
        return Promise.resolve();
      },
      animateTurn: () => Promise.resolve(),
      animateBump: () => Promise.resolve(),
      animatePickup: () => Promise.resolve(),
      animatePush: () => Promise.resolve(),
      animateAttack: () => Promise.resolve(),
      animateDefeat: () => Promise.resolve(),
      animatePause: () => Promise.resolve(),
      setSpeed: () => undefined,
      setWorld: () => undefined,
    } as unknown as Engine;
    const res = await execute(parse("move(7);"), {
      world,
      engine: aborter,
      signal: ctrl.signal,
    });
    expect(res.win).toBe(false);
    expect(res.message).toMatch(/stop/i);
    // Hero made 2 steps before STOP, not all 7.
    expect(world.hero.x).toBeLessThan(8);
    expect(stepCount).toBeLessThanOrEqual(3);
  });
});
