/**
 * First-visit onboarding overlay. Shows automatically the first time a
 * player loads the page, and again any time they hit the "How to play"
 * link in the footer. The dismissal is persisted in localStorage so a
 * returning player doesn't get the welcome dialog every reload.
 */

const SEEN_KEY = "codequest:onboarded";

function loadSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function saveSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export class Onboarding {
  private root: HTMLElement;
  private closeBtn: HTMLButtonElement;
  private backdrop: HTMLElement;
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

  constructor(
    rootSelector = "#onboarding",
    closeSelector = "#onboardingClose",
    backdropSelector = "#onboarding .onboarding-backdrop",
  ) {
    const root = document.querySelector<HTMLElement>(rootSelector);
    const closeBtn = document.querySelector<HTMLButtonElement>(closeSelector);
    const backdrop = document.querySelector<HTMLElement>(backdropSelector);
    if (!root || !closeBtn || !backdrop) {
      throw new Error("Onboarding DOM not found");
    }
    this.root = root;
    this.closeBtn = closeBtn;
    this.backdrop = backdrop;

    this.closeBtn.addEventListener("click", () => this.close());
    this.backdrop.addEventListener("click", () => this.close());
    document.addEventListener("keydown", this.keyHandler);
  }

  /** Show the overlay if the player has never seen it. */
  showIfFirstTime() {
    if (!loadSeen()) this.open();
  }

  open(opener: HTMLElement | null = null) {
    this.opener = opener ?? (document.activeElement as HTMLElement | null);
    this.root.hidden = false;
    // Defer focus to next tick so the focus ring lands after layout.
    requestAnimationFrame(() => this.closeBtn.focus());
  }

  close() {
    if (this.root.hidden) return;
    this.root.hidden = true;
    saveSeen();
    if (this.opener && typeof this.opener.focus === "function") {
      this.opener.focus();
    }
    this.opener = null;
  }

  /** Keep keyboard focus inside the dialog while it's open. */
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
