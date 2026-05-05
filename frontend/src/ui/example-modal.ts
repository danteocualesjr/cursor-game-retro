/**
 * "One way to solve it" modal.
 *
 * Shown automatically the first time a player solves each level
 * (deduped by levelId in localStorage), with options to load the
 * canonical solution into the editor or just close. The same
 * focus-trap + Esc-dismiss pattern as the onboarding modal.
 *
 * Reads localStorage:codequest:examples-seen as a comma-separated
 * list of solved levelIds we've already shown the example for.
 */

const SEEN_KEY = "codequest:examples-seen";

function loadSeen(): Set<number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(
      raw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n)),
    );
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<number>) {
  try {
    localStorage.setItem(SEEN_KEY, [...seen].join(","));
  } catch {
    /* ignore */
  }
}

export interface ExampleHandlers {
  /** Called when the player clicks LOAD INTO EDITOR. */
  onLoad: (code: string) => void;
}

export class ExampleModal {
  private root: HTMLElement;
  private closeBtn: HTMLButtonElement;
  private loadBtn: HTMLButtonElement;
  private backdrop: HTMLElement;
  private codeEl: HTMLElement;
  private opener: HTMLElement | null = null;
  private currentCode = "";
  private handlers: ExampleHandlers;
  private seen = loadSeen();

  private keyHandler = (e: KeyboardEvent) => {
    if (this.root.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    } else if (e.key === "Tab") {
      this.trapFocus(e);
    }
  };

  constructor(handlers: ExampleHandlers) {
    this.handlers = handlers;
    const root = document.querySelector<HTMLElement>("#exampleModal");
    const closeBtn = document.querySelector<HTMLButtonElement>("#exampleClose");
    const loadBtn = document.querySelector<HTMLButtonElement>("#exampleLoadBtn");
    const backdrop = document.querySelector<HTMLElement>(
      "#exampleModal .onboarding-backdrop",
    );
    const codeEl = document.querySelector<HTMLElement>("#exampleCode");
    if (!root || !closeBtn || !loadBtn || !backdrop || !codeEl) {
      throw new Error("Example-modal DOM not found");
    }
    this.root = root;
    this.closeBtn = closeBtn;
    this.loadBtn = loadBtn;
    this.backdrop = backdrop;
    this.codeEl = codeEl;

    this.closeBtn.addEventListener("click", () => this.close());
    this.backdrop.addEventListener("click", () => this.close());
    this.loadBtn.addEventListener("click", () => {
      this.handlers.onLoad(this.currentCode);
      this.close();
    });
    document.addEventListener("keydown", this.keyHandler);
  }

  /** Show the modal once per levelId. Returns true if shown, false if
   *  already seen for that level. */
  showIfFirstTime(levelId: number, code: string, opener?: HTMLElement | null) {
    if (this.seen.has(levelId)) return false;
    this.seen.add(levelId);
    saveSeen(this.seen);
    this.show(code, opener ?? null);
    return true;
  }

  /** Force-show regardless of seen state. */
  show(code: string, opener: HTMLElement | null = null) {
    this.opener = opener ?? (document.activeElement as HTMLElement | null);
    this.currentCode = code;
    this.codeEl.textContent = code;
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

  /** Has the player been shown the example for this level? */
  hasSeen(levelId: number): boolean {
    return this.seen.has(levelId);
  }

  /** Currently visible? */
  get isOpen(): boolean {
    return !this.root.hidden;
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
