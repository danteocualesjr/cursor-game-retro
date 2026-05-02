import {
  type World,
  type Direction,
  delta,
  tileAt,
} from "./grid";

const TILE = 32;

interface Anim {
  kind: "move" | "turn" | "bump" | "pickup" | "push" | "attack" | "fade";
  startMs: number;
  durationMs: number;
  data: Record<string, number | string>;
  resolve: () => void;
}

const PALETTE = {
  bg: "#10102a",
  floorA: "#21214a",
  floorB: "#1b1b3e",
  wallTop: "#5050a0",
  wallSide: "#33336e",
  wallShadow: "#181830",
  goal: "#ffd633",
  goalGlow: "#ffe680",
  switchOff: "#553355",
  switchOn: "#66ff99",
  hero: "#ffe0b3",
  heroTunic: "#33aaff",
  heroHair: "#552200",
  heroSword: "#dddddd",
  crate: "#a86b3c",
  crateDark: "#6b3f1f",
  slime: "#66ff99",
  slimeDark: "#338855",
  fadeOverlay: "rgba(0,0,0,0.0)",
};

export class Engine {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  world: World;
  anim: Anim | null = null;
  pickupFlashes: { x: number; y: number; color: string; t0: number }[] = [];
  defeatFlashes: { x: number; y: number; t0: number }[] = [];
  speed = 1; // multiplier
  private rafId = 0;

  constructor(canvas: HTMLCanvasElement, world: World) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    this.world = world;
    this.resize();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  setWorld(world: World) {
    this.world = world;
    this.anim = null;
    this.pickupFlashes = [];
    this.defeatFlashes = [];
    this.resize();
  }

  setSpeed(mult: number) {
    this.speed = mult;
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
  }

  private resize() {
    const w = this.world.width * TILE;
    const h = this.world.height * TILE;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /** Animate the hero stepping forward one tile. The world.hero coords are
   *  pre-mutated to the destination tile by the interpreter; the engine only
   *  smoothly tweens the visual position. */
  animateMove(fromX: number, fromY: number): Promise<void> {
    return this.startAnim({
      kind: "move",
      durationMs: 220,
      data: { fromX, fromY },
    });
  }

  animateTurn(fromDir: Direction): Promise<void> {
    return this.startAnim({
      kind: "turn",
      durationMs: 120,
      data: { fromDir },
    });
  }

  animateBump(): Promise<void> {
    return this.startAnim({
      kind: "bump",
      durationMs: 200,
      data: {},
    });
  }

  animatePickup(x: number, y: number, color: string): Promise<void> {
    this.pickupFlashes.push({ x, y, color, t0: performance.now() });
    return this.startAnim({
      kind: "pickup",
      durationMs: 220,
      data: { x, y },
    });
  }

  animatePush(fromX: number, fromY: number): Promise<void> {
    return this.startAnim({
      kind: "push",
      durationMs: 280,
      data: { fromX, fromY },
    });
  }

  animateAttack(): Promise<void> {
    return this.startAnim({
      kind: "attack",
      durationMs: 240,
      data: {},
    });
  }

  animateDefeat(x: number, y: number): Promise<void> {
    this.defeatFlashes.push({ x, y, t0: performance.now() });
    return new Promise((r) => setTimeout(r, 200 / this.speed));
  }

  /** Wait briefly, useful for "wait" actions after errors. */
  animatePause(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms / this.speed));
  }

  private startAnim(spec: Omit<Anim, "startMs" | "resolve">): Promise<void> {
    return new Promise((resolve) => {
      this.anim = {
        ...spec,
        startMs: performance.now(),
        durationMs: spec.durationMs / this.speed,
        resolve,
      };
    });
  }

  private loop(now: number) {
    if (this.anim) {
      const t = (now - this.anim.startMs) / this.anim.durationMs;
      if (t >= 1) {
        const done = this.anim;
        this.anim = null;
        done.resolve();
      }
    }
    this.render(now);
    this.rafId = requestAnimationFrame(this.loop);
  }

  private heroPixel(now: number): { px: number; py: number; bumpOffset: number } {
    const { hero } = this.world;
    let px = hero.x * TILE;
    let py = hero.y * TILE;
    let bumpOffset = 0;
    if (this.anim?.kind === "move") {
      const t = clamp01((now - this.anim.startMs) / this.anim.durationMs);
      const fromX = (this.anim.data.fromX as number) * TILE;
      const fromY = (this.anim.data.fromY as number) * TILE;
      const eased = easeInOut(t);
      px = lerp(fromX, px, eased);
      py = lerp(fromY, py, eased);
    } else if (this.anim?.kind === "bump") {
      const t = clamp01((now - this.anim.startMs) / this.anim.durationMs);
      const offset = Math.sin(t * Math.PI) * 6;
      const { dx, dy } = delta(hero.dir);
      px += dx * offset;
      py += dy * offset;
      bumpOffset = offset;
    } else if (this.anim?.kind === "attack") {
      const t = clamp01((now - this.anim.startMs) / this.anim.durationMs);
      const offset = Math.sin(t * Math.PI) * 8;
      const { dx, dy } = delta(hero.dir);
      px += dx * offset;
      py += dy * offset;
    }
    return { px, py, bumpOffset };
  }

  private cratePixel(
    crateX: number,
    crateY: number,
    now: number,
  ): { px: number; py: number } {
    let px = crateX * TILE;
    let py = crateY * TILE;
    if (this.anim?.kind === "push") {
      const t = clamp01((now - this.anim.startMs) / this.anim.durationMs);
      const fromX = (this.anim.data.fromX as number) * TILE;
      const fromY = (this.anim.data.fromY as number) * TILE;
      const heroFrom = { x: fromX / TILE, y: fromY / TILE };
      const { dx, dy } = delta(this.world.hero.dir);
      const expectedFromCrateX = heroFrom.x + dx;
      const expectedFromCrateY = heroFrom.y + dy;
      if (
        crateX === expectedFromCrateX + dx &&
        crateY === expectedFromCrateY + dy
      ) {
        const eased = easeInOut(t);
        px = lerp((expectedFromCrateX) * TILE, crateX * TILE, eased);
        py = lerp((expectedFromCrateY) * TILE, crateY * TILE, eased);
      }
    }
    return { px, py };
  }

  private render(now: number) {
    const { ctx, world } = this;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        this.drawTile(x, y, now);
      }
    }

    for (const sw of world.switches) {
      this.drawSwitchOverlay(sw.x, sw.y, sw.active);
    }

    for (const gem of world.gems) {
      this.drawGem(gem.x, gem.y, gem.color, now);
    }

    for (const crate of world.crates) {
      const { px, py } = this.cratePixel(crate.x, crate.y, now);
      this.drawCrate(px, py);
    }

    for (const slime of world.slimes) {
      this.drawSlime(slime.x * TILE, slime.y * TILE, now);
    }

    const hp = this.heroPixel(now);
    this.drawHero(hp.px, hp.py, world.hero.dir, now);

    this.drawPickupFlashes(now);
    this.drawDefeatFlashes(now);
  }

  private drawTile(x: number, y: number, now: number) {
    const { ctx } = this;
    const px = x * TILE;
    const py = y * TILE;
    const t = tileAt(this.world, x, y);

    if (t === "wall") {
      ctx.fillStyle = PALETTE.wallSide;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 8);
      ctx.fillStyle = PALETTE.wallShadow;
      ctx.fillRect(px + 2, py + TILE - 6, TILE - 4, 4);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(px + Math.floor(TILE / 2) - 1, py + 4, 2, TILE - 12);
      return;
    }

    const checker = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
    ctx.fillStyle = checker;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(px + 4, py + 4, 2, 2);
    ctx.fillRect(px + TILE - 8, py + TILE - 8, 2, 2);

    if (t === "goal") {
      const pulse = 0.5 + 0.5 * Math.sin(now / 220);
      ctx.fillStyle = PALETTE.goal;
      ctx.globalAlpha = 0.4 + 0.4 * pulse;
      ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = PALETTE.goalGlow;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 6, py + 6, TILE - 12, TILE - 12);
    }
    if (t === "switch") {
      ctx.fillStyle = PALETTE.switchOff;
      ctx.fillRect(px + 4, py + TILE - 10, TILE - 8, 6);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(px + 4, py + TILE - 6, TILE - 8, 2);
    }
  }

  private drawSwitchOverlay(x: number, y: number, active: boolean) {
    if (!active) return;
    const { ctx } = this;
    const px = x * TILE;
    const py = y * TILE;
    ctx.fillStyle = PALETTE.switchOn;
    ctx.fillRect(px + 4, py + TILE - 8, TILE - 8, 4);
  }

  private drawGem(x: number, y: number, color: string, now: number) {
    const { ctx } = this;
    const px = x * TILE + TILE / 2;
    const py = y * TILE + TILE / 2 + Math.sin(now / 200 + x + y) * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(px, py - 8);
    ctx.lineTo(px + 8, py);
    ctx.lineTo(px, py + 8);
    ctx.lineTo(px - 8, py);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(px - 3, py - 4, 2, 2);
  }

  private drawCrate(px: number, py: number) {
    const { ctx } = this;
    ctx.fillStyle = PALETTE.crate;
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = PALETTE.crateDark;
    ctx.fillRect(px + 3, py + 3, TILE - 6, 2);
    ctx.fillRect(px + 3, py + TILE - 5, TILE - 6, 2);
    ctx.fillRect(px + 3, py + 3, 2, TILE - 6);
    ctx.fillRect(px + TILE - 5, py + 3, 2, TILE - 6);
    ctx.strokeStyle = PALETTE.crateDark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 4);
    ctx.lineTo(px + TILE - 4, py + TILE - 4);
    ctx.moveTo(px + TILE - 4, py + 4);
    ctx.lineTo(px + 4, py + TILE - 4);
    ctx.stroke();
  }

  private drawSlime(px: number, py: number, now: number) {
    const { ctx } = this;
    const wobble = Math.sin(now / 160) * 1.5;
    ctx.fillStyle = PALETTE.slimeDark;
    ctx.beginPath();
    ctx.ellipse(
      px + TILE / 2,
      py + TILE - 6 + wobble,
      TILE / 2 - 2,
      6,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = PALETTE.slime;
    ctx.beginPath();
    ctx.ellipse(
      px + TILE / 2,
      py + TILE / 2 + 4 + wobble,
      TILE / 2 - 4,
      TILE / 2 - 4,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.fillRect(px + 10, py + 14 + wobble, 3, 3);
    ctx.fillRect(px + TILE - 13, py + 14 + wobble, 3, 3);
  }

  private drawHero(px: number, py: number, dir: Direction, now: number) {
    const { ctx } = this;
    const cx = px + TILE / 2;
    const bob = Math.sin(now / 180) * 1;

    ctx.fillStyle = PALETTE.heroTunic;
    ctx.fillRect(px + 8, py + 14 + bob, TILE - 16, 12);

    ctx.fillStyle = PALETTE.hero;
    ctx.fillRect(px + 10, py + 6 + bob, TILE - 20, 10);

    ctx.fillStyle = PALETTE.heroHair;
    ctx.fillRect(px + 10, py + 4 + bob, TILE - 20, 4);

    ctx.fillStyle = "#000";
    if (dir === "right") {
      ctx.fillRect(px + TILE - 14, py + 9 + bob, 2, 2);
      ctx.fillStyle = PALETTE.heroSword;
      ctx.fillRect(px + TILE - 4, py + 14 + bob, 4, 8);
    } else if (dir === "left") {
      ctx.fillRect(px + 12, py + 9 + bob, 2, 2);
      ctx.fillStyle = PALETTE.heroSword;
      ctx.fillRect(px, py + 14 + bob, 4, 8);
    } else if (dir === "up") {
      ctx.fillRect(px + 12, py + 7 + bob, 2, 2);
      ctx.fillRect(px + TILE - 14, py + 7 + bob, 2, 2);
      ctx.fillStyle = PALETTE.heroSword;
      ctx.fillRect(cx - 1, py + 2 + bob, 2, 6);
    } else {
      ctx.fillRect(px + 12, py + 11 + bob, 2, 2);
      ctx.fillRect(px + TILE - 14, py + 11 + bob, 2, 2);
      ctx.fillStyle = PALETTE.heroSword;
      ctx.fillRect(cx - 1, py + TILE - 4 + bob, 2, 6);
    }

    ctx.fillStyle = "#000000aa";
    ctx.fillRect(px + 10, py + TILE - 4, TILE - 20, 2);
  }

  private drawPickupFlashes(now: number) {
    const { ctx } = this;
    this.pickupFlashes = this.pickupFlashes.filter((f) => {
      const t = (now - f.t0) / 400;
      if (t > 1) return false;
      const px = f.x * TILE + TILE / 2;
      const py = f.y * TILE + TILE / 2 - t * 20;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(px, py, 4 + t * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });
  }

  private drawDefeatFlashes(now: number) {
    const { ctx } = this;
    this.defeatFlashes = this.defeatFlashes.filter((f) => {
      const t = (now - f.t0) / 360;
      if (t > 1) return false;
      const px = f.x * TILE + TILE / 2;
      const py = f.y * TILE + TILE / 2;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const r = 4 + t * 18;
        ctx.fillRect(px + Math.cos(a) * r - 1, py + Math.sin(a) * r - 1, 3, 3);
      }
      ctx.globalAlpha = 1;
      return true;
    });
  }
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
