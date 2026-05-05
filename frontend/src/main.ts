import { Engine } from "./game/engine";
import { buildWorld } from "./game/grid";
import { execute, parse, ParseError } from "./game/interpreter";
import { LEVELS, levelById } from "./game/levels";
import { audio } from "./game/audio";
import { CodeEditor } from "./ui/editor";
import { HootTutor } from "./ui/tutor";
import { Hud } from "./ui/hud";
import { Onboarding } from "./ui/onboarding";
import { explainError, getHealth, requestHint } from "./api";

const STORAGE_KEY = "codequest:progress";
const CODE_KEY = (id: number) => `codequest:code:${id}`;
const SPEED_KEY = "codequest:speed";
const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

interface Progress {
  solved: number[];
  current: number;
  /** Best (highest) star count earned per level id (1-3). */
  stars?: Record<number, number>;
  /** Best (lowest) step count achieved per level id. */
  bestSteps?: Record<number, number>;
}

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      p.stars ??= {};
      p.bestSteps ??= {};
      return p;
    }
  } catch {
    /* fall through */
  }
  return { solved: [], current: 1, stars: {}, bestSteps: {} };
}

function starsForSteps(steps: number, par: number): number {
  if (steps <= par) return 3;
  if (steps <= Math.ceil(par * 1.5)) return 2;
  return 1;
}

function saveProgress(p: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* localStorage disabled, oh well */
  }
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const editorEl = document.getElementById("editor") as HTMLElement;
const runBtn = document.getElementById("runBtn") as HTMLButtonElement;
const resetBtn = document.getElementById("resetBtn") as HTMLButtonElement;
const hintBtn = document.getElementById("hintBtn") as HTMLButtonElement;
const speedBtn = document.getElementById("speedBtn") as HTMLButtonElement;
const muteBtn = document.getElementById("muteBtn") as HTMLButtonElement;
const howBtn = document.getElementById("howBtn") as HTMLButtonElement;

const hud = new Hud();
const hoot = new HootTutor();
const progress = loadProgress();

let currentLevelId = progress.current;
let world = buildWorld(levelById(currentLevelId));
const engine = new Engine(canvas, world);
const editor = new CodeEditor(editorEl, loadCode(currentLevelId));
let speed: Speed = loadSpeed();
applySpeed(speed);

let runAbort: AbortController | null = null;
let lastError: { line: number; message: string } | null = null;

hud.setCmdInsertHandler((name) => editor.insertSnippet(name));
renderHud();
hud.setLevel(world.level);
hud.setGoalProgress(world);
reflectMuteButton();

runBtn.addEventListener("click", () => {
  if (runAbort) {
    stopProgram();
  } else {
    runProgram();
  }
});
resetBtn.addEventListener("click", () => resetLevel());
hintBtn.addEventListener("click", () => askHoot());
speedBtn.addEventListener("click", () => cycleSpeed());
muteBtn.addEventListener("click", () => toggleMute());

window.addEventListener("keydown", (e) => {
  // Don't fire game shortcuts while a modal is open - Esc and Enter
  // belong to the dialog in that case.
  const onboardingEl = document.getElementById("onboarding");
  if (onboardingEl && !onboardingEl.hidden) return;
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (runAbort) stopProgram();
    else runProgram();
  }
  if (e.key === "Escape" && runAbort) {
    e.preventDefault();
    stopProgram();
  }
});

editor.view.dom.addEventListener("input", () => {
  saveCode(currentLevelId, editor.getCode());
});

function loadCode(id: number): string {
  try {
    const saved = localStorage.getItem(CODE_KEY(id));
    if (saved !== null) return saved;
  } catch {
    /* ignore */
  }
  return levelById(id).starterCode;
}

function saveCode(id: number, code: string) {
  try {
    localStorage.setItem(CODE_KEY(id), code);
  } catch {
    /* ignore */
  }
}

function renderHud() {
  hud.renderPills(
    LEVELS,
    currentLevelId,
    new Set(progress.solved),
    progress.stars ?? {},
    progress.bestSteps ?? {},
    (id) => {
      if (id === currentLevelId) return;
      selectLevel(id);
    },
  );
}

function selectLevel(id: number) {
  if (runAbort) runAbort.abort();
  saveCode(currentLevelId, editor.getCode());
  currentLevelId = id;
  progress.current = id;
  saveProgress(progress);
  world = buildWorld(levelById(id));
  engine.setWorld(world);
  editor.setCode(loadCode(id));
  editor.setExecutingLine(null);
  hud.setLevel(world.level);
  hud.setGoalProgress(world);
  hoot.hide();
  lastError = null;
  renderHud();
}

function resetLevel() {
  if (runAbort) runAbort.abort();
  world = buildWorld(levelById(currentLevelId));
  engine.setWorld(world);
  editor.setExecutingLine(null);
  hud.setStatus("Level reset.", "");
  hud.setSteps(0);
  hud.setGoalProgress(world);
  hoot.hide();
  lastError = null;
}

async function runProgram() {
  if (runAbort) runAbort.abort();
  audio.ensure();
  resetWorldOnly();
  saveCode(currentLevelId, editor.getCode());

  const code = editor.getCode();
  let program;
  try {
    program = parse(code);
  } catch (e) {
    if (e instanceof ParseError) {
      lastError = { line: e.line, message: e.message };
      hud.setStatus(`Line ${e.line}: ${trimMessage(e.message)}`, "bad");
      audio.error();
      hoot.show(`Hmm. Line ${e.line}: ${trimMessage(e.message)}`, { sticky: true });
      askHootForError().catch(() => {});
      return;
    }
    throw e;
  }

  setRunning(true);
  hud.setStatus("Running...", "");
  hoot.hide();
  const ctrl = new AbortController();
  runAbort = ctrl;

  try {
    const result = await execute(program, {
      world,
      engine,
      signal: ctrl.signal,
      onStep: () => {
        hud.setSteps(world.steps);
        hud.setGoalProgress(world);
      },
      onLine: (line) => editor.setExecutingLine(line),
    });
    if (result.win) {
      onWin();
    } else if (result.errorLine !== undefined) {
      lastError = { line: result.errorLine, message: result.message };
      hud.setStatus(`Line ${result.errorLine}: ${trimMessage(result.message)}`, "bad");
      hoot.show(
        `Whoops! Line ${result.errorLine}: ${trimMessage(result.message)}`,
        { sticky: true },
      );
      askHootForError().catch(() => {});
    } else {
      hud.setStatus(result.message, "");
    }
  } catch (e) {
    console.error(e);
    hud.setStatus("Something went wrong while running your code.", "bad");
  } finally {
    setRunning(false);
    runAbort = null;
    editor.setExecutingLine(null);
  }
}

function resetWorldOnly() {
  world = buildWorld(levelById(currentLevelId));
  engine.setWorld(world);
}

function onWin() {
  audio.win();
  const par = world.level.parSteps;
  const stars = starsForSteps(world.steps, par);
  const starGlyphs = "*".repeat(stars) + ".".repeat(3 - stars);
  hud.setStatus(`Solved in ${world.steps} steps! ${starGlyphs}`, "good");

  progress.stars ??= {};
  progress.bestSteps ??= {};
  if (!progress.solved.includes(currentLevelId)) {
    progress.solved.push(currentLevelId);
  }
  const prevStars = progress.stars[currentLevelId] ?? 0;
  if (stars > prevStars) progress.stars[currentLevelId] = stars;
  const prevBest = progress.bestSteps[currentLevelId];
  if (prevBest === undefined || world.steps < prevBest) {
    progress.bestSteps[currentLevelId] = world.steps;
  }
  saveProgress(progress);
  renderHud();
  document.querySelector(".game-pane")?.classList.add("win-flash");
  setTimeout(
    () => document.querySelector(".game-pane")?.classList.remove("win-flash"),
    700,
  );
  const starWord =
    stars === 3 ? "Three stars! Optimal!" : stars === 2 ? "Two stars - try shaving a few steps." : "One star - can you do it in fewer steps?";
  const next = LEVELS.find((l) => l.id === currentLevelId + 1);
  if (next) {
    hoot.show(
      `You did it! ${starWord} Pick the next pill, or replay this one.`,
      { sticky: true },
    );
  } else {
    hoot.show(`Wow! You finished every quest. ${starWord} You're a real coder now.`, {
      sticky: true,
    });
  }
}

function setRunning(running: boolean) {
  // RUN button doubles as STOP while a program is in flight, so it stays
  // enabled - the click handler routes to runProgram() vs stopProgram().
  runBtn.disabled = false;
  runBtn.classList.toggle("running", running);
  runBtn.classList.toggle("btn-primary", !running);
  runBtn.classList.toggle("btn-stop", running);
  runBtn.textContent = running ? "STOP" : "RUN";
  runBtn.setAttribute("aria-label", running ? "Stop running program" : "Run program");
  editor.setEditable(!running);
}

function stopProgram() {
  if (runAbort) {
    runAbort.abort();
    hud.setStatus("Stopped.", "");
  }
}

function trimMessage(msg: string): string {
  // Strip "Line N: " prefix if present, since we re-add it ourselves.
  return msg.replace(/^Line \d+:\s*/, "");
}

async function askHoot() {
  audio.ensure();
  hoot.show("Hoot is thinking...", { thinking: true, sticky: true });
  try {
    const res = await requestHint({
      levelId: currentLevelId,
      levelName: world.level.name,
      intro: world.level.intro,
      allowedCommands: world.level.allowedCommands,
      code: editor.getCode(),
      lastError: lastError ?? undefined,
    });
    hoot.show(res.text, { sticky: false });
  } catch (e) {
    hoot.show(
      e instanceof Error
        ? `Hoot ruffles his feathers. ${e.message}`
        : "Hoot can't think right now.",
      { sticky: false },
    );
  }
}

async function askHootForError() {
  if (!lastError) return;
  hoot.show("Hoot is reading your code...", { thinking: true, sticky: true });
  try {
    const res = await explainError({
      levelId: currentLevelId,
      code: editor.getCode(),
      errorLine: lastError.line,
      errorMessage: trimMessage(lastError.message),
    });
    hoot.show(res.text, { sticky: false });
  } catch (e) {
    hoot.show(
      e instanceof Error
        ? `Hoot ruffles his feathers. ${e.message}`
        : "Hoot is silent.",
      { sticky: false },
    );
  }
}

function toggleMute() {
  audio.setMuted(!audio.muted);
  reflectMuteButton();
}

function reflectMuteButton() {
  const muted = audio.muted;
  muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  muteBtn.setAttribute("aria-label", muted ? "Sound off" : "Sound on");
  muteBtn.title = muted ? "Sound off (click to enable)" : "Sound on (click to mute)";
  const wave1 = document.getElementById("muteWave1");
  const wave2 = document.getElementById("muteWave2");
  if (wave1) wave1.style.display = muted ? "none" : "";
  if (wave2) wave2.style.display = muted ? "none" : "";
  // When muted, show a slash through the speaker.
  const icon = document.getElementById("muteIcon");
  if (icon) {
    let slash = icon.querySelector<SVGLineElement>("line.mute-slash");
    if (muted) {
      if (!slash) {
        slash = document.createElementNS("http://www.w3.org/2000/svg", "line");
        slash.setAttribute("class", "mute-slash");
        slash.setAttribute("x1", "3");
        slash.setAttribute("y1", "3");
        slash.setAttribute("x2", "21");
        slash.setAttribute("y2", "21");
        slash.setAttribute("stroke", "currentColor");
        slash.setAttribute("stroke-width", "2.5");
        icon.appendChild(slash);
      }
    } else if (slash) {
      slash.remove();
    }
  }
  const label = document.getElementById("muteLabel");
  if (label) label.textContent = muted ? "Sound off" : "Sound on";
}

function loadSpeed(): Speed {
  try {
    const raw = localStorage.getItem(SPEED_KEY);
    const n = raw ? Number(raw) : NaN;
    if (SPEEDS.includes(n as Speed)) return n as Speed;
  } catch {
    /* ignore */
  }
  // Honor the OS-level reduced-motion preference: default to fast.
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return 4;
    }
  } catch {
    /* ignore */
  }
  return 1;
}

function applySpeed(s: Speed) {
  speed = s;
  engine.setSpeed(s);
  speedBtn.classList.toggle("fast", s === 2);
  speedBtn.classList.toggle("faster", s === 4);
  speedBtn.setAttribute("aria-label", `Animation speed: ${s}x`);
  speedBtn.title = `Speed ${s}x (click to cycle)`;
  const label = document.getElementById("speedLabel");
  if (label) label.textContent = `${s}x`;
  // Render 1, 2, or 4 stacked play triangles inside the SVG icon.
  const icon = document.getElementById("speedIcon") as SVGElement | null;
  if (icon) {
    icon.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";
    const polyOf = (pts: string) => {
      const p = document.createElementNS(ns, "polygon");
      p.setAttribute("points", pts);
      p.setAttribute("fill", "currentColor");
      return p;
    };
    if (s === 1) {
      icon.appendChild(polyOf("6,4 6,20 18,12"));
    } else if (s === 2) {
      icon.appendChild(polyOf("3,4 3,20 12,12"));
      icon.appendChild(polyOf("12,4 12,20 21,12"));
    } else {
      // 4 stacked half-height triangles forming a chevron grid
      icon.appendChild(polyOf("2,3 2,11 10,7"));
      icon.appendChild(polyOf("12,3 12,11 20,7"));
      icon.appendChild(polyOf("2,13 2,21 10,17"));
      icon.appendChild(polyOf("12,13 12,21 20,17"));
    }
  }
  try {
    localStorage.setItem(SPEED_KEY, String(s));
  } catch {
    /* ignore */
  }
}

function cycleSpeed() {
  const i = SPEEDS.indexOf(speed);
  applySpeed(SPEEDS[(i + 1) % SPEEDS.length]);
}

// Pre-flight: hide Hoot until first interaction.
hoot.hide();

const onboarding = new Onboarding();
howBtn.addEventListener("click", () => onboarding.open(howBtn));
onboarding.showIfFirstTime();

void refreshTutorHealth();

async function refreshTutorHealth() {
  const badge = document.getElementById("tutorBadge");
  if (!badge) return;
  const dot = badge.querySelector(".tutor-badge-dot");
  const text = badge.querySelector(".tutor-badge-text");
  const setState = (
    state: "online" | "fallback" | "offline",
    label: string,
    title: string,
  ) => {
    badge.classList.remove(
      "tutor-badge-unknown",
      "tutor-badge-online",
      "tutor-badge-fallback",
      "tutor-badge-offline",
    );
    badge.classList.add(`tutor-badge-${state}`);
    if (text) text.textContent = label;
    badge.title = title;
    if (dot) dot.setAttribute("aria-hidden", "true");
  };

  const health = await getHealth();
  if (!health) {
    setState(
      "offline",
      "tutor offline",
      "Backend isn't reachable. Hoot's hint button will fail until it comes back.",
    );
    hintBtn.title = "Backend offline - HINT will fail until it returns";
    return;
  }
  if (health.cursorSdk) {
    setState(
      "online",
      "tutor live",
      `AI tutor is live (model: ${health.model}). HINT calls a real Cursor agent.`,
    );
    hintBtn.title = `Ask the AI tutor (live, model: ${health.model})`;
  } else {
    setState(
      "fallback",
      "fallback hints",
      "No CURSOR_API_KEY configured on the backend - HINT serves canned, per-level fallback hints.",
    );
    hintBtn.title = "Ask Hoot (using canned fallback hints - no Cursor API key)";
  }
}
