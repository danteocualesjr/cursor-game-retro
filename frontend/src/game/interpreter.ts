import type { Engine } from "./engine";
import {
  type World,
  checkGoal,
  crateAt,
  delta,
  gemAt,
  isWalkable,
  refreshSwitches,
  senseAhead,
  senseHere,
  slimeAt,
  tileAt,
  turnLeft as dirLeft,
  turnRight as dirRight,
} from "./grid";
import { audio } from "./audio";

// ----------------------------- AST -----------------------------

export type Stmt =
  | { kind: "call"; name: string; args: Arg[]; line: number }
  | { kind: "repeat"; count: number; body: Stmt[]; line: number }
  | {
      kind: "if";
      sensorName: string;
      sensorArg: string;
      body: Stmt[];
      elseBody: Stmt[] | null;
      line: number;
    }
  | { kind: "while"; sensorName: string; sensorArg: string; body: Stmt[]; line: number };

export type Arg = { kind: "number"; value: number } | { kind: "string"; value: string };

// ----------------------------- ERRORS -----------------------------

export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number,
  ) {
    super(`Line ${line}: ${message}`);
  }
}

export class RuntimeError extends Error {
  constructor(message: string, public line: number) {
    super(`Line ${line}: ${message}`);
  }
}

// ----------------------------- TOKENIZER -----------------------------

type TokKind =
  | "ident"
  | "number"
  | "string"
  | "lparen"
  | "rparen"
  | "lbrace"
  | "rbrace"
  | "semi"
  | "comma";

interface Tok {
  kind: TokKind;
  value: string;
  line: number;
  col: number;
}

function tokenize(src: string): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (src[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };

  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      advance();
      continue;
    }
    // Line comment: //
    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") advance();
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen", value: "(", line, col });
      advance();
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen", value: ")", line, col });
      advance();
      continue;
    }
    if (ch === "{") {
      tokens.push({ kind: "lbrace", value: "{", line, col });
      advance();
      continue;
    }
    if (ch === "}") {
      tokens.push({ kind: "rbrace", value: "}", line, col });
      advance();
      continue;
    }
    if (ch === ";") {
      tokens.push({ kind: "semi", value: ";", line, col });
      advance();
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma", value: ",", line, col });
      advance();
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const startLine = line;
      const startCol = col;
      advance();
      let str = "";
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\n") {
          throw new ParseError("Strings can't span lines.", startLine, startCol);
        }
        str += src[i];
        advance();
      }
      if (i >= src.length) {
        throw new ParseError("Missing closing quote on string.", startLine, startCol);
      }
      advance(); // consume closing quote
      tokens.push({ kind: "string", value: str, line: startLine, col: startCol });
      continue;
    }
    if (/[0-9]/.test(ch)) {
      const startCol = col;
      let n = "";
      while (i < src.length && /[0-9]/.test(src[i])) {
        n += src[i];
        advance();
      }
      tokens.push({ kind: "number", value: n, line, col: startCol });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const startCol = col;
      let id = "";
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) {
        id += src[i];
        advance();
      }
      tokens.push({ kind: "ident", value: id, line, col: startCol });
      continue;
    }
    throw new ParseError(`I don't recognize the character "${ch}".`, line, col);
  }

  return tokens;
}

// ----------------------------- PARSER -----------------------------

const COMMANDS = new Set([
  "move",
  "turnLeft",
  "turnRight",
  "pickUp",
  "push",
  "attack",
  "wait",
]);

const SENSORS = new Set(["sees", "here"]);

class Parser {
  i = 0;
  constructor(public toks: Tok[]) {}

  peek(): Tok | null {
    return this.toks[this.i] ?? null;
  }

  eat(kind: TokKind): Tok {
    const t = this.toks[this.i];
    if (!t) {
      const last = this.toks[this.toks.length - 1];
      throw new ParseError(
        `I expected a "${kind}" but ran out of code.`,
        last?.line ?? 1,
        last?.col ?? 1,
      );
    }
    if (t.kind !== kind) {
      throw new ParseError(
        `I expected a "${kind}" but found "${t.value}".`,
        t.line,
        t.col,
      );
    }
    this.i++;
    return t;
  }

  parseProgram(): Stmt[] {
    const stmts: Stmt[] = [];
    while (this.peek()) {
      stmts.push(this.parseStmt());
    }
    return stmts;
  }

  parseStmt(): Stmt {
    const t = this.peek()!;
    if (t.kind !== "ident") {
      throw new ParseError(
        `I expected a command name but found "${t.value}".`,
        t.line,
        t.col,
      );
    }
    if (t.value === "repeat") return this.parseRepeat();
    if (t.value === "if") return this.parseIf();
    if (t.value === "while") return this.parseWhile();
    return this.parseCall();
  }

  parseCall(): Stmt {
    const ident = this.eat("ident");
    if (!COMMANDS.has(ident.value)) {
      throw new ParseError(
        `I don't know the command "${ident.value}". Try one of: ${Array.from(COMMANDS).join(", ")}.`,
        ident.line,
        ident.col,
      );
    }
    this.eat("lparen");
    const args: Arg[] = [];
    if (this.peek()?.kind !== "rparen") {
      args.push(this.parseArg());
      while (this.peek()?.kind === "comma") {
        this.eat("comma");
        args.push(this.parseArg());
      }
    }
    this.eat("rparen");
    this.eatSemiIfPresent();
    return { kind: "call", name: ident.value, args, line: ident.line };
  }

  parseArg(): Arg {
    const t = this.peek()!;
    if (t.kind === "number") {
      this.eat("number");
      return { kind: "number", value: parseInt(t.value, 10) };
    }
    if (t.kind === "string") {
      this.eat("string");
      return { kind: "string", value: t.value };
    }
    throw new ParseError(
      `I expected a number or "text in quotes" but found "${t.value}".`,
      t.line,
      t.col,
    );
  }

  parseRepeat(): Stmt {
    const ident = this.eat("ident");
    this.eat("lparen");
    const num = this.eat("number");
    this.eat("rparen");
    const body = this.parseBlock();
    this.eatSemiIfPresent();
    return {
      kind: "repeat",
      count: parseInt(num.value, 10),
      body,
      line: ident.line,
    };
  }

  parseIf(): Stmt {
    const ident = this.eat("ident");
    this.eat("lparen");
    const sensor = this.eat("ident");
    if (!SENSORS.has(sensor.value)) {
      throw new ParseError(
        `I expected a sensor like "sees" but found "${sensor.value}".`,
        sensor.line,
        sensor.col,
      );
    }
    this.eat("lparen");
    const arg = this.eat("string");
    this.eat("rparen");
    this.eat("rparen");
    const body = this.parseBlock();
    let elseBody: Stmt[] | null = null;
    if (this.peek()?.kind === "ident" && this.peek()?.value === "else") {
      this.eat("ident");
      elseBody = this.parseBlock();
    }
    this.eatSemiIfPresent();
    return {
      kind: "if",
      sensorName: sensor.value,
      sensorArg: arg.value,
      body,
      elseBody,
      line: ident.line,
    };
  }

  parseWhile(): Stmt {
    const ident = this.eat("ident");
    this.eat("lparen");
    const sensor = this.eat("ident");
    if (!SENSORS.has(sensor.value)) {
      throw new ParseError(
        `I expected a sensor like "sees" but found "${sensor.value}".`,
        sensor.line,
        sensor.col,
      );
    }
    this.eat("lparen");
    const arg = this.eat("string");
    this.eat("rparen");
    this.eat("rparen");
    const body = this.parseBlock();
    this.eatSemiIfPresent();
    return {
      kind: "while",
      sensorName: sensor.value,
      sensorArg: arg.value,
      body,
      line: ident.line,
    };
  }

  parseBlock(): Stmt[] {
    this.eat("lbrace");
    const stmts: Stmt[] = [];
    while (this.peek() && this.peek()!.kind !== "rbrace") {
      stmts.push(this.parseStmt());
    }
    this.eat("rbrace");
    return stmts;
  }

  private eatSemiIfPresent() {
    if (this.peek()?.kind === "semi") this.eat("semi");
  }
}

export function parse(src: string): Stmt[] {
  return new Parser(tokenize(src)).parseProgram();
}

// ----------------------------- RUNTIME -----------------------------

const STEP_LIMIT = 400;
const LOOP_LIMIT = 100;

export interface RunContext {
  world: World;
  engine: Engine;
  signal: AbortSignal;
  onStep?: () => void;
}

export interface RunResult {
  win: boolean;
  steps: number;
  message: string;
  errorLine?: number;
}

class WinSignal {
  constructor(public message: string) {}
}

class CancelSignal {}

export async function execute(program: Stmt[], ctx: RunContext): Promise<RunResult> {
  try {
    for (const stmt of program) {
      await runStmt(stmt, ctx);
    }
  } catch (e) {
    if (e instanceof WinSignal) {
      return { win: true, steps: ctx.world.steps, message: e.message };
    }
    if (e instanceof CancelSignal) {
      return { win: false, steps: ctx.world.steps, message: "Stopped." };
    }
    if (e instanceof RuntimeError) {
      audio.error();
      return { win: false, steps: ctx.world.steps, message: e.message, errorLine: e.line };
    }
    throw e;
  }
  if (checkGoal(ctx.world)) {
    audio.win();
    return { win: true, steps: ctx.world.steps, message: "You did it!" };
  }
  return {
    win: false,
    steps: ctx.world.steps,
    message: "Your code finished, but you didn't reach the goal yet.",
  };
}

async function runStmt(stmt: Stmt, ctx: RunContext): Promise<void> {
  if (ctx.signal.aborted) throw new CancelSignal();
  if (ctx.world.steps > STEP_LIMIT) {
    throw new RuntimeError(
      `That's a lot of steps (over ${STEP_LIMIT}). Maybe there's an infinite loop?`,
      stmt.line,
    );
  }

  switch (stmt.kind) {
    case "call":
      await runCall(stmt, ctx);
      return;
    case "repeat": {
      if (stmt.count < 0 || stmt.count > LOOP_LIMIT) {
        throw new RuntimeError(
          `repeat() takes a number between 0 and ${LOOP_LIMIT}.`,
          stmt.line,
        );
      }
      for (let i = 0; i < stmt.count; i++) {
        for (const s of stmt.body) await runStmt(s, ctx);
      }
      return;
    }
    case "if": {
      const passed = senseFor(ctx.world, stmt.sensorName, stmt.sensorArg);
      const body = passed ? stmt.body : stmt.elseBody ?? [];
      for (const s of body) await runStmt(s, ctx);
      return;
    }
    case "while": {
      let guard = 0;
      while (senseFor(ctx.world, stmt.sensorName, stmt.sensorArg)) {
        guard++;
        if (guard > LOOP_LIMIT) {
          throw new RuntimeError(
            `while() ran ${LOOP_LIMIT} times without stopping. Loop forever?`,
            stmt.line,
          );
        }
        for (const s of stmt.body) await runStmt(s, ctx);
      }
      return;
    }
  }
}

async function runCall(stmt: Extract<Stmt, { kind: "call" }>, ctx: RunContext) {
  const { world, engine } = ctx;
  switch (stmt.name) {
    case "move": {
      const n =
        stmt.args.length === 0
          ? 1
          : stmt.args[0].kind === "number"
          ? stmt.args[0].value
          : (() => {
              throw new RuntimeError("move() needs a number, like move(3).", stmt.line);
            })();
      if (n < 0) throw new RuntimeError("move() needs a positive number.", stmt.line);
      for (let i = 0; i < n; i++) {
        await stepForward(stmt.line, ctx);
      }
      return;
    }
    case "turnLeft":
      world.hero.dir = dirLeft(world.hero.dir);
      audio.turn();
      await engine.animateTurn(world.hero.dir);
      world.steps++;
      checkWin(world);
      return;
    case "turnRight":
      world.hero.dir = dirRight(world.hero.dir);
      audio.turn();
      await engine.animateTurn(world.hero.dir);
      world.steps++;
      checkWin(world);
      return;
    case "pickUp": {
      const gem = gemAt(world, world.hero.x, world.hero.y);
      if (!gem) {
        throw new RuntimeError(
          "There's nothing to pick up on this tile. Move onto a gem first.",
          stmt.line,
        );
      }
      world.gems = world.gems.filter((g) => g !== gem);
      audio.pickup();
      await engine.animatePickup(gem.x, gem.y, gem.color);
      world.steps++;
      checkWin(world);
      return;
    }
    case "push": {
      const { dx, dy } = delta(world.hero.dir);
      const tx = world.hero.x + dx;
      const ty = world.hero.y + dy;
      const crate = crateAt(world, tx, ty);
      if (!crate) {
        throw new RuntimeError("There's no crate in front of you to push.", stmt.line);
      }
      const nx = crate.x + dx;
      const ny = crate.y + dy;
      const blocked =
        tileAt(world, nx, ny) === "wall" || crateAt(world, nx, ny);
      if (blocked) {
        throw new RuntimeError("The crate has nowhere to go.", stmt.line);
      }
      const slime = slimeAt(world, nx, ny);
      crate.x = nx;
      crate.y = ny;
      const fromX = world.hero.x;
      const fromY = world.hero.y;
      world.hero.x = tx;
      world.hero.y = ty;
      audio.push();
      await engine.animatePush(fromX, fromY);
      if (slime) {
        world.slimes = world.slimes.filter((s) => s !== slime);
        await engine.animateDefeat(slime.x, slime.y);
      }
      refreshSwitches(world);
      world.steps++;
      checkWin(world);
      return;
    }
    case "attack": {
      const { dx, dy } = delta(world.hero.dir);
      const tx = world.hero.x + dx;
      const ty = world.hero.y + dy;
      const slime = slimeAt(world, tx, ty);
      if (!slime) {
        throw new RuntimeError("There's no slime in front of you to attack.", stmt.line);
      }
      audio.attack();
      await engine.animateAttack();
      slime.hp--;
      if (slime.hp <= 0) {
        world.slimes = world.slimes.filter((s) => s !== slime);
        await engine.animateDefeat(slime.x, slime.y);
      }
      world.steps++;
      checkWin(world);
      return;
    }
    case "wait":
      await engine.animatePause(200);
      world.steps++;
      return;
  }
}

async function stepForward(line: number, ctx: RunContext) {
  const { world, engine } = ctx;
  const { dx, dy } = delta(world.hero.dir);
  const tx = world.hero.x + dx;
  const ty = world.hero.y + dy;

  if (!isWalkable(world, tx, ty)) {
    audio.bump();
    await engine.animateBump();
    if (tileAt(world, tx, ty) === "wall") {
      throw new RuntimeError("Bonk! There's a wall in the way.", line);
    }
    if (crateAt(world, tx, ty)) {
      throw new RuntimeError(
        "There's a crate in the way. Maybe try push()?",
        line,
      );
    }
    if (slimeAt(world, tx, ty)) {
      throw new RuntimeError(
        "A slime is blocking the path. Maybe try attack()?",
        line,
      );
    }
    throw new RuntimeError("Something is blocking the way.", line);
  }

  const fromX = world.hero.x;
  const fromY = world.hero.y;
  world.hero.x = tx;
  world.hero.y = ty;
  audio.step();
  await engine.animateMove(fromX, fromY);

  // auto-pickup-on-walk is OFF; kid must call pickUp() explicitly to learn it.

  world.steps++;
  ctx.onStep?.();
  checkWin(world);
}

function checkWin(world: World) {
  if (checkGoal(world)) {
    throw new WinSignal("You did it!");
  }
}

function senseFor(world: World, name: string, arg: string): boolean {
  if (name === "here") return senseHere(world, arg);
  return senseAhead(world, arg);
}
