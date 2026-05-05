/**
 * "ACHIEVEMENTS" modal: lists every achievement with locked vs
 * unlocked state, descriptions, and unlock dates.
 */

import { ACHIEVEMENTS, loadUnlocks } from "../game/achievements";

export class AchievementModal {
  private root: HTMLElement;
  private closeBtn: HTMLButtonElement;
  private backdrop: HTMLElement;
  private list: HTMLElement;
  private opener: HTMLElement | null = null;

  private keyHandler = (e: KeyboardEvent) => {
    if (this.root.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    } else if (e.key === "Tab") {
      this.trapFocus(e);
    }
  };

  constructor() {
    const root = document.querySelector<HTMLElement>("#achievementsModal");
    const closeBtn = document.querySelector<HTMLButtonElement>(
      "#achievementsClose",
    );
    const backdrop = document.querySelector<HTMLElement>(
      "#achievementsModal .onboarding-backdrop",
    );
    const list = document.querySelector<HTMLElement>("#achievementsList");
    if (!root || !closeBtn || !backdrop || !list) {
      throw new Error("Achievement-modal DOM not found");
    }
    this.root = root;
    this.closeBtn = closeBtn;
    this.backdrop = backdrop;
    this.list = list;

    this.closeBtn.addEventListener("click", () => this.close());
    this.backdrop.addEventListener("click", () => this.close());
    document.addEventListener("keydown", this.keyHandler);
  }

  open(opener: HTMLElement | null = null) {
    this.opener = opener ?? (document.activeElement as HTMLElement | null);
    this.render();
    this.root.hidden = false;
    requestAnimationFrame(() => this.closeBtn.focus());
  }

  close() {
    if (this.root.hidden) return;
    this.root.hidden = true;
    if (this.opener && typeof this.opener.focus === "function") {
      this.opener.focus();
    }
    this.opener = null;
  }

  private render() {
    const unlocks = loadUnlocks();
    this.list.innerHTML = "";
    const totalUnlocked = ACHIEVEMENTS.filter((a) => unlocks[a.id]).length;
    const summary = document.createElement("div");
    summary.className = "achievement-summary";
    summary.textContent = `${totalUnlocked} of ${ACHIEVEMENTS.length} unlocked`;
    this.list.appendChild(summary);

    for (const a of ACHIEVEMENTS) {
      const unlockedAt = unlocks[a.id];
      const item = document.createElement("div");
      item.className = "achievement-row" + (unlockedAt ? " unlocked" : "");
      const date = unlockedAt ? formatDate(unlockedAt) : "Locked";
      item.innerHTML = `
        <div class="achievement-row-monogram" aria-hidden="true">${escapeHtml(
          unlockedAt ? a.name[0] : "?",
        )}</div>
        <div class="achievement-row-body">
          <div class="achievement-row-name">${escapeHtml(a.name)}</div>
          <div class="achievement-row-desc">${escapeHtml(a.description)}</div>
        </div>
        <div class="achievement-row-date">${escapeHtml(date)}</div>
      `;
      this.list.appendChild(item);
    }
  }

  private trapFocus(e: KeyboardEvent) {
    const focusables = this.root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
