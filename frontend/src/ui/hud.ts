import type { LevelSpec, World } from "../game/grid";

export class Hud {
  private objective: HTMLElement;
  private status: HTMLElement;
  private cmds: HTMLElement;
  private pillBox: HTMLElement;
  private stepsBox: HTMLElement;
  private stepsValue: HTMLElement;
  private goalMeter: HTMLElement;
  private goalMeterValue: HTMLElement;
  private bumpTimer: number | null = null;
  private lastSteps = 0;
  private lastGoalRatio = -1;

  constructor() {
    this.objective = mustEl("#objective");
    this.status = mustEl("#status");
    this.cmds = mustEl("#cmdsList");
    this.pillBox = mustEl("#levelPills");
    this.stepsBox = mustEl("#steps");
    this.stepsValue = mustEl("#stepsValue");
    this.goalMeter = mustEl("#goalMeter");
    this.goalMeterValue = mustEl("#goalMeterValue");
  }

  setLevel(level: LevelSpec) {
    this.objective.innerHTML = `<span class="label">LEVEL ${level.id} - ${level.name.toUpperCase()}</span>${escapeHtml(
      level.intro,
    )}`;
    this.cmds.textContent = level.allowedCommands.join(", ");
    this.setStatus("");
    this.setSteps(0);
    this.lastGoalRatio = -1;
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
  ) {
    this.pillBox.innerHTML = "";
    for (const lvl of levels) {
      const wrap = document.createElement("div");
      wrap.className = "level-pill-wrap";

      const btn = document.createElement("button");
      btn.className = "level-pill";
      if (solved.has(lvl.id)) btn.classList.add("solved");
      if (lvl.id === currentId) btn.classList.add("current");
      btn.textContent = String(lvl.id);
      const earnedStars = stars[lvl.id] ?? 0;
      const best = bestSteps[lvl.id];
      const tooltipParts = [
        `${lvl.name} - par ${lvl.parSteps} steps`,
        best !== undefined
          ? `Your best: ${best} steps (${earnedStars}/3 stars)`
          : "Not solved yet",
      ];
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

      if (best !== undefined) {
        const bestLabel = document.createElement("span");
        bestLabel.className = "level-pill-best";
        bestLabel.textContent = `${best}`;
        bestLabel.setAttribute("aria-label", `best: ${best} steps`);
        bestLabel.title = `Best: ${best} steps (par ${lvl.parSteps})`;
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
