export type Direction = "up" | "right" | "down" | "left";

export type TileType = "floor" | "wall" | "goal" | "switch";

export interface GemEntity {
  x: number;
  y: number;
  color: string;
}

export interface CrateEntity {
  x: number;
  y: number;
}

export interface SlimeEntity {
  x: number;
  y: number;
  hp: number;
}

export interface SwitchSpec {
  x: number;
  y: number;
  active: boolean;
}

export type GoalSpec =
  | { kind: "reach"; x: number; y: number }
  | { kind: "collect-all" }
  | { kind: "switches" }
  | { kind: "defeat-all" };

export interface LevelSpec {
  id: number;
  name: string;
  intro: string;
  starterCode: string;
  allowedCommands: string[];
  /**
   * Grid as a string, one row per line. Legend:
   *   . floor        W wall         G goal tile
   *   H hero         g blue gem     y yellow gem    p pink gem
   *   c crate        s switch       m slime
   * Hero direction defaults to "right"; use "^" "v" "<" ">" instead of H to override.
   */
  grid: string;
  goal: GoalSpec;
}

export interface World {
  level: LevelSpec;
  width: number;
  height: number;
  tiles: TileType[][];
  hero: { x: number; y: number; dir: Direction };
  gems: GemEntity[];
  crates: CrateEntity[];
  slimes: SlimeEntity[];
  switches: SwitchSpec[];
  totalGems: number;
  totalSlimes: number;
  steps: number;
  messages: string[];
}

const DIR_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
};

export function delta(dir: Direction): { dx: number; dy: number } {
  return DIR_DELTA[dir];
}

export function turnLeft(dir: Direction): Direction {
  const order: Direction[] = ["up", "left", "down", "right"];
  const i = order.indexOf(dir);
  return order[(i + 1) % 4];
}

export function turnRight(dir: Direction): Direction {
  const order: Direction[] = ["up", "right", "down", "left"];
  const i = order.indexOf(dir);
  return order[(i + 1) % 4];
}

const GEM_COLORS: Record<string, string> = {
  g: "#66ccff",
  y: "#ffd633",
  p: "#ff66aa",
};

export function buildWorld(level: LevelSpec): World {
  const rows = level.grid
    .split("\n")
    // Spaces are visual padding only - drop them so each char is one tile.
    .map((row) => row.replace(/\s+/g, ""))
    .filter((row) => row.length > 0);

  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));

  const tiles: TileType[][] = [];
  let hero: World["hero"] = { x: 0, y: 0, dir: "right" };
  const gems: GemEntity[] = [];
  const crates: CrateEntity[] = [];
  const slimes: SlimeEntity[] = [];
  const switches: SwitchSpec[] = [];

  for (let y = 0; y < height; y++) {
    const row: TileType[] = [];
    const line = rows[y].padEnd(width, "W");
    for (let x = 0; x < width; x++) {
      const ch = line[x];
      switch (ch) {
        case "W":
          row.push("wall");
          break;
        case "G":
          row.push("goal");
          break;
        case "s":
          row.push("switch");
          switches.push({ x, y, active: false });
          break;
        default:
          row.push("floor");
      }
      switch (ch) {
        case "H":
          hero = { x, y, dir: "right" };
          break;
        case ">":
          hero = { x, y, dir: "right" };
          break;
        case "<":
          hero = { x, y, dir: "left" };
          break;
        case "^":
          hero = { x, y, dir: "up" };
          break;
        case "v":
          hero = { x, y, dir: "down" };
          break;
        case "g":
        case "y":
        case "p":
          gems.push({ x, y, color: GEM_COLORS[ch] });
          break;
        case "c":
          crates.push({ x, y });
          break;
        case "m":
          slimes.push({ x, y, hp: 1 });
          break;
      }
    }
    tiles.push(row);
  }

  return {
    level,
    width,
    height,
    tiles,
    hero,
    gems,
    crates,
    slimes,
    switches,
    totalGems: gems.length,
    totalSlimes: slimes.length,
    steps: 0,
    messages: [],
  };
}

export function tileAt(world: World, x: number, y: number): TileType {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return "wall";
  return world.tiles[y][x];
}

export function isWalkable(world: World, x: number, y: number): boolean {
  const t = tileAt(world, x, y);
  if (t === "wall") return false;
  if (world.crates.some((c) => c.x === x && c.y === y)) return false;
  if (world.slimes.some((s) => s.x === x && s.y === y)) return false;
  return true;
}

export function gemAt(world: World, x: number, y: number): GemEntity | undefined {
  return world.gems.find((g) => g.x === x && g.y === y);
}

export function crateAt(world: World, x: number, y: number): CrateEntity | undefined {
  return world.crates.find((c) => c.x === x && c.y === y);
}

export function slimeAt(world: World, x: number, y: number): SlimeEntity | undefined {
  return world.slimes.find((s) => s.x === x && s.y === y);
}

export function switchAt(world: World, x: number, y: number): SwitchSpec | undefined {
  return world.switches.find((s) => s.x === x && s.y === y);
}

/** What does the hero "see" one tile in front of them? */
export function senseAhead(world: World, what: string): boolean {
  const { dx, dy } = delta(world.hero.dir);
  return senseAt(world, world.hero.x + dx, world.hero.y + dy, what);
}

/** What is on the tile the hero is currently standing on? */
export function senseHere(world: World, what: string): boolean {
  return senseAt(world, world.hero.x, world.hero.y, what);
}

function senseAt(world: World, x: number, y: number, what: string): boolean {
  switch (what) {
    case "gem":
      return !!gemAt(world, x, y);
    case "wall":
      return tileAt(world, x, y) === "wall";
    case "crate":
      return !!crateAt(world, x, y);
    case "slime":
      return !!slimeAt(world, x, y);
    case "switch":
      return tileAt(world, x, y) === "switch";
    case "goal":
      return tileAt(world, x, y) === "goal";
    case "open":
      return isWalkable(world, x, y);
    default:
      return false;
  }
}

export function checkGoal(world: World): boolean {
  switch (world.level.goal.kind) {
    case "reach":
      return world.hero.x === world.level.goal.x && world.hero.y === world.level.goal.y;
    case "collect-all":
      return world.gems.length === 0 && world.totalGems > 0;
    case "switches":
      return world.switches.length > 0 && world.switches.every((s) => s.active);
    case "defeat-all":
      return world.slimes.length === 0 && world.totalSlimes > 0;
  }
}

export function refreshSwitches(world: World): void {
  for (const sw of world.switches) {
    sw.active = world.crates.some((c) => c.x === sw.x && c.y === sw.y);
  }
}
