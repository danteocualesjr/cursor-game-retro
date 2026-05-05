import type { LevelSpec, World } from "../game/grid";
import { snippetFor } from "../game/dsl-snippets";

export class Hud {
  private objective: HTMLElement;
  private status: HTMLElement;
  private cmds: HTMLElement;
  private pillBox: HTMLElement;
  private stepsBox: HTMLElement;
  private stepsValue: HTMLElement;
  private goalMeter: HTMLElement;
  private goalMeterValue: HTMLElement;
  private timerBox: HTMLElement;
  private timerValue: HTMLElement;
  private timerRaf: number | null = null;
  private timerStart = 0;
  private timerPaused = 0;
  private bumpTimer: number | null = null;
  private lastSteps = 0;
  private lastGoalRatio = -1;
  private onCmdInsert: ((name: string) => void) | null = null;

  constructor() {
    this.objective = mustEl("#objective");
    this.status = mustEl("#status");
    this.cmds = mustEl("#cmdsList");
    this.pillBox = mustEl("#levelPills");
    this.stepsBox = mustEl("#steps");
    this.stepsValue = mustEl("#stepsValue");
    this.goalMeter = mustEl("#goalMeter");
    this.goalMeterValue = mustEl("#goalMeterValue");
    this.timerBox = mustEl("#timer");
    this.timerValue = mustEl("#timerValue");
  }

  /** Start the speedrun timer. Idempotent - if already running, no-op. */
  startTimer() {
    if (this.timerRaf !== null) return;
    this.timerStart = performance.now() - this.timerPaused;
    this.timerBox.classList.add("running");
    this.timerBox.classList.remove("best");
    const tick = () => {
      const elapsed = performance.now() - this.timerStart;
      this.renderTime(elapsed);
      this.timerRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  /** Stop the timer and return its final reading in milliseconds. */
  stopTimer(): number {
    if (this.timerRaf !== null) {
      cancelAnimationFrame(this.timerRaf);
      this.timerRaf = null;
    }
    this.timerBox.classList.remove("running");
    if (this.timerStart === 0) return 0;
    const elapsed = performance.now() - this.timerStart;
    this.timerPaused = elapsed;
    this.renderTime(elapsed);
    return Math.round(elapsed);
  }

  /** Reset the timer to 0.0s. */
  resetTimer() {
    if (this.timerRaf !== null) {
      cancelAnimationFrame(this.timerRaf);
      this.timerRaf = null;
    }
    this.timerStart = 0;
    this.timerPaused = 0;
    this.timerBox.classList.remove("running", "best");
    this.renderTime(0);
  }

  /** Mark the current frozen time as a new personal best. */
  flagTimerBest() {
    this.timerBox.classList.add("best");
  }

  private renderTime(ms: number) {
    const secs = ms / 1000;
    this.timerValue.textContent = `${secs.toFixed(1)}s`;
  }

  /** Wire the click-to-insert behavior of the command chips. */
  setCmdInsertHandler(fn: (name: string) => void) {
    this.onCmdInsert = fn;
  }

  setLevel(level: LevelSpec) {
    this.objective.innerHTML = `<span class="label">LEVEL ${level.id} - ${level.name.toUpperCase()}</span>${escapeHtml(
      level.intro,
    )}`;
    this.renderCmdChips(level.allowedCommands);
    this.setStatus("");
    this.setSteps(0);
    this.lastGoalRatio = -1;
  }

  private renderCmdChips(commands: ReadonlyArray<string>) {
    this.cmds.innerHTML = "";
    for (const name of commands) {
      const snip = snippetFor(name);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cmd-chip";
      btn.classList.add(`cmd-chip-${snip?.kind ?? "function"}`);
      btn.textContent = name;
      btn.title = snip
        ? `${snip.detail} - ${snip.info}\n(click to insert)`
        : `Insert ${name}`;
      btn.addEventListener("click", () => this.onCmdInsert?.(name));
      this.cmds.appendChild(btn);
    }
  }

  /** Recompute and render the live goal-progress meter. */
  setGoalProgress(world: World) {
    const goal = world.level.goal;
    let label: string | null = null;
    let ratio = 0;
    switch (goal.kind) {
      case "collect-all": {
        const left = world.gems.length;
        const total = world.totalGems;
        const done = total - left;
        if (total > 0) {
          label = `${done}/${total} gems`;
          ratio = done / total;
        }
        break;
      }
      case "switches": {
        const total = world.switches.length;
        const done = world.switches.filter((s) => s.active).length;
        if (total > 0) {
          label = `${done}/${total} switches`;
          ratio = done / total;
        }
        break;
      }
      case "defeat-all": {
        const total = world.totalSlimes;
        const left = world.slimes.length;
        const done = total - left;
        if (total > 0) {
          label = `${done}/${total} slimes`;
          ratio = done / total;
        }
        break;
      }
      case "reach":
        // No live count - the goal tile itself is the indicator.
        break;
    }
    if (label === null) {
      this.goalMeter.hidden = true;
      this.lastGoalRatio = -1;
      return;
    }
    this.goalMeter.hidden = false;
    this.goalMeterValue.textContent = label;
    const wasIncomplete = this.lastGoalRatio < 1;
    if (ratio >= 1) {
      this.goalMeter.classList.add("complete");
      if (wasIncomplete) {
        // Replay the flash animation on the moment of completion.
        this.goalMeter.classList.remove("complete");
        void this.goalMeter.offsetWidth;
        this.goalMeter.classList.add("complete");
      }
    } else {
      this.goalMeter.classList.remove("complete");
    }
    this.lastGoalRatio = ratio;
  }

  setSteps(n: number) {
    if (n === this.lastSteps) {
      this.stepsValue.textContent = String(n);
      return;
    }
    const grew = n > this.lastSteps;
    this.lastSteps = n;
    this.stepsValue.textContent = String(n);
    if (grew) {
      this.stepsBox.classList.remove("bumped");
      // Force a reflow so the animation restarts on rapid increments.
      void this.stepsBox.offsetWidth;
      this.stepsBox.classList.add("bumped");
      if (this.bumpTimer) window.clearTimeout(this.bumpTimer);
      this.bumpTimer = window.setTimeout(() => {
        this.stepsBox.classList.remove("bumped");
        this.bumpTimer = null;
      }, 250);
    }
  }

  setStatus(text: string, kind: "" | "good" | "bad" = "") {
    this.status.textContent = text;
    this.status.classList.remove("good", "bad");
    if (kind) this.status.classList.add(kind);
  }

  renderPills(
    levels: LevelSpec[],
    currentId: number,
    solved: Set<number>,
    stars: Record<number, number>,
    bestSteps: Record<number, number>,
    onPick: (id: number) => void,
    bestTimeMs: Record<number, number> = {},
  ) {
    this.pillBox.innerHTML = "";
    for (const lvl of levels) {
      const wrap = document.createElement("div");
      wrap.className = "level-pill-wrap";
      const isDaily = lvl.id === 0;
      if (isDaily) wrap.classList.add("daily");

      const btn = document.createElement("button");
      btn.className = "level-pill";
      if (solved.has(lvl.id)) btn.classList.add("solved");
      if (lvl.id === currentId) btn.classList.add("current");
      if (isDaily) btn.classList.add("daily");
      btn.textContent = isDaily ? "★" : String(lvl.id);
      const earnedStars = stars[lvl.id] ?? 0;
      const best = bestSteps[lvl.id];
      const bestTime = bestTimeMs[lvl.id];
      const bestSummary =
        best !== undefined
          ? `Your best: ${best} steps${
              bestTime !== undefined ? `, ${(bestTime / 1000).toFixed(1)}s` : ""
            } (${earnedStars}/3 stars)`
          : "Not solved yet";
      const tooltipParts = [`${lvl.name} - par ${lvl.parSteps} steps`, bestSummary];
      btn.title = tooltipParts.join("\n");
      btn.addEventListener("click", () => onPick(lvl.id));
      wrap.appendChild(btn);

      const starRow = document.createElement("div");
      starRow.className = "level-pill-stars";
      starRow.setAttribute("aria-label", `${earnedStars} of 3 stars`);
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement("span");
        dot.className = "star-dot" + (i < earnedStars ? " earned" : "");
        starRow.appendChild(dot);
      }
      wrap.appendChild(starRow);

      if (isDaily) {
        const dailyLabel = document.createElement("span");
        dailyLabel.className = "level-pill-best level-pill-daily";
        dailyLabel.textContent = "DAILY";
        wrap.appendChild(dailyLabel);
      } else if (best !== undefined) {
        const bestLabel = document.createElement("span");
        bestLabel.className = "level-pill-best";
        bestLabel.textContent = `${best}`;
        bestLabel.setAttribute("aria-label", `best: ${best} steps`);
        bestLabel.title =
          bestTime !== undefined
            ? `Best: ${best} steps, ${(bestTime / 1000).toFixed(1)}s (par ${lvl.parSteps})`
            : `Best: ${best} steps (par ${lvl.parSteps})`;
        wrap.appendChild(bestLabel);
      }

      this.pillBox.appendChild(wrap);
    }
  }
}

function mustEl(sel: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
