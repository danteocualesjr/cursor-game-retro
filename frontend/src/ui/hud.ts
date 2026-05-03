import type { LevelSpec } from "../game/grid";

export class Hud {
  private objective: HTMLElement;
  private status: HTMLElement;
  private cmds: HTMLElement;
  private pillBox: HTMLElement;
  private stepsBox: HTMLElement;
  private stepsValue: HTMLElement;
  private bumpTimer: number | null = null;
  private lastSteps = 0;

  constructor() {
    this.objective = mustEl("#objective");
    this.status = mustEl("#status");
    this.cmds = mustEl("#cmdsList");
    this.pillBox = mustEl("#levelPills");
    this.stepsBox = mustEl("#steps");
    this.stepsValue = mustEl("#stepsValue");
  }

  setLevel(level: LevelSpec) {
    this.objective.innerHTML = `<span class="label">LEVEL ${level.id} - ${level.name.toUpperCase()}</span>${escapeHtml(
      level.intro,
    )}`;
    this.cmds.textContent = level.allowedCommands.join(", ");
    this.setStatus("");
    this.setSteps(0);
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
      btn.title = `${lvl.name} - par ${lvl.parSteps} steps`;
      btn.addEventListener("click", () => onPick(lvl.id));
      wrap.appendChild(btn);

      const earned = stars[lvl.id] ?? 0;
      const starRow = document.createElement("div");
      starRow.className = "level-pill-stars";
      starRow.setAttribute("aria-label", `${earned} of 3 stars`);
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement("span");
        dot.className = "star-dot" + (i < earned ? " earned" : "");
        starRow.appendChild(dot);
      }
      wrap.appendChild(starRow);

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
