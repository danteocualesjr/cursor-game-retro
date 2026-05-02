import { Engine } from "./game/engine";
import { buildWorld } from "./game/grid";
import { execute, parse, ParseError } from "./game/interpreter";
import { LEVELS, levelById } from "./game/levels";
import { audio } from "./game/audio";
import { CodeEditor } from "./ui/editor";
import { HootTutor } from "./ui/tutor";
import { Hud } from "./ui/hud";
import { explainError, requestHint } from "./api";

const STORAGE_KEY = "codequest:progress";
const CODE_KEY = (id: number) => `codequest:code:${id}`;

interface Progress {
  solved: number[];
  current: number;
}

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Progress;
  } catch {
    /* fall through */
  }
  return { solved: [], current: 1 };
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
const muteBtn = document.getElementById("muteBtn") as HTMLButtonElement;

const hud = new Hud();
const hoot = new HootTutor();
const progress = loadProgress();

let currentLevelId = progress.current;
let world = buildWorld(levelById(currentLevelId));
const engine = new Engine(canvas, world);
const editor = new CodeEditor(editorEl, loadCode(currentLevelId));

let runAbort: AbortController | null = null;
let lastError: { line: number; message: string } | null = null;

renderHud();
hud.setLevel(world.level);

runBtn.addEventListener("click", () => runProgram());
resetBtn.addEventListener("click", () => resetLevel());
hintBtn.addEventListener("click", () => askHoot());
muteBtn.addEventListener("click", () => toggleMute());

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    runProgram();
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
  hud.renderPills(LEVELS, currentLevelId, new Set(progress.solved), (id) => {
    if (id === currentLevelId) return;
    selectLevel(id);
  });
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
  hud.setLevel(world.level);
  hoot.hide();
  lastError = null;
  renderHud();
}

function resetLevel() {
  if (runAbort) runAbort.abort();
  world = buildWorld(levelById(currentLevelId));
  engine.setWorld(world);
  hud.setStatus("Level reset.", "");
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
      onStep: () => hud.setSteps(world.steps),
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
  }
}

function resetWorldOnly() {
  world = buildWorld(levelById(currentLevelId));
  engine.setWorld(world);
}

function onWin() {
  audio.win();
  hud.setStatus(`Solved in ${world.steps} steps!`, "good");
  if (!progress.solved.includes(currentLevelId)) {
    progress.solved.push(currentLevelId);
  }
  saveProgress(progress);
  renderHud();
  document.querySelector(".game-pane")?.classList.add("win-flash");
  setTimeout(
    () => document.querySelector(".game-pane")?.classList.remove("win-flash"),
    700,
  );
  const next = LEVELS.find((l) => l.id === currentLevelId + 1);
  if (next) {
    hoot.show(
      `You did it! Press a level pill to try the next quest, or replay this one.`,
      { sticky: true },
    );
  } else {
    hoot.show(`Wow! You finished every quest. You're a real coder now.`, {
      sticky: true,
    });
  }
}

function setRunning(running: boolean) {
  runBtn.disabled = running;
  resetBtn.disabled = running;
  editor.setEditable(!running);
  runBtn.textContent = running ? "RUNNING" : "RUN";
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
  muteBtn.textContent = audio.muted ? "SOUND OFF" : "SOUND ON";
}

// Pre-flight: hide Hoot until first interaction.
hoot.hide();
