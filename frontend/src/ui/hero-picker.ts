/**
 * Hero customization modal.
 *
 * 5 named tunic colors the player can pick from. The chosen color is
 * persisted in localStorage:codequest:hero-color and re-applied on
 * boot via Engine.setHeroTunic. The modal pops from a HERO link in
 * the footer, uses the same focus-trap + Esc dismissal pattern as
 * the onboarding/example modals.
 */

const STORAGE_KEY = "codequest:hero-color";

export interface HeroPalette {
  id: string;
  name: string;
  /** Tunic hex passed to Engine.setHeroTunic. */
  tunic: string;
  /** One-line flavor used as the option's title attribute. */
  flavor: string;
}

export const HERO_PALETTES: ReadonlyArray<HeroPalette> = [
  {
    id: "blue",
    name: "Hero Blue",
    tunic: "#00f0ff",
    flavor: "The classic. Electric cyan, arcade-cabinet bright.",
  },
  {
    id: "forest",
    name: "Forest",
    tunic: "#39c447",
    flavor: "Mossy green. For sneaking through gem groves.",
  },
  {
    id: "crimson",
    name: "Crimson",
    tunic: "#ff2e3a",
    flavor: "Hot red. Battle-ready, slime-stomping.",
  },
  {
    id: "ghost",
    name: "Ghost",
    tunic: "#e6e6f5",
    flavor: "Pale silver. Spectral and silent.",
  },
  {
    id: "sunbeam",
    name: "Sunbeam",
    tunic: "#ffea00",
    flavor: "Pure neon yellow. Walks into rooms first.",
  },
];

export function loadHero(): HeroPalette {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id) {
      const found = HERO_PALETTES.find((p) => p.id === id);
      if (found) return found;
    }
  } catch {
    /* ignore */
  }
  return HERO_PALETTES[0];
}

function saveHero(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export interface HeroPickerHandlers {
  onChange: (palette: HeroPalette) => void;
}

export class HeroPicker {
  private root: HTMLElement;
  private closeBtn: HTMLButtonElement;
  private backdrop: HTMLElement;
  private grid: HTMLElement;
  private opener: HTMLElement | null = null;
  private current: HeroPalette;
  private handlers: HeroPickerHandlers;

  private keyHandler = (e: KeyboardEvent) => {
    if (this.root.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    } else if (e.key === "Tab") {
      this.trapFocus(e);
    }
  };

  constructor(handlers: HeroPickerHandlers) {
    this.handlers = handlers;
    this.current = loadHero();

    const root = document.querySelector<HTMLElement>("#heroPicker");
    const closeBtn = document.querySelector<HTMLButtonElement>("#heroPickerClose");
    const backdrop = document.querySelector<HTMLElement>(
      "#heroPicker .onboarding-backdrop",
    );
    const grid = document.querySelector<HTMLElement>("#heroPickerGrid");
    if (!root || !closeBtn || !backdrop || !grid) {
      throw new Error("Hero-picker DOM not found");
    }
    this.root = root;
    this.closeBtn = closeBtn;
    this.backdrop = backdrop;
    this.grid = grid;

    this.closeBtn.addEventListener("click", () => this.close());
    this.backdrop.addEventListener("click", () => this.close());
    document.addEventListener("keydown", this.keyHandler);

    this.renderSwatches();
  }

  private renderSwatches() {
    this.grid.innerHTML = "";
    for (const p of HERO_PALETTES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hero-swatch";
      if (p.id === this.current.id) btn.classList.add("selected");
      btn.title = p.flavor;
      btn.setAttribute("aria-label", `${p.name} - ${p.flavor}`);
      btn.setAttribute("aria-pressed", p.id === this.current.id ? "true" : "false");
      btn.innerHTML = `
        <span class="hero-swatch-tunic" style="background:${p.tunic}"></span>
        <span class="hero-swatch-name">${p.name}</span>
      `;
      btn.addEventListener("click", () => this.choose(p));
      this.grid.appendChild(btn);
    }
  }

  private choose(p: HeroPalette) {
    this.current = p;
    saveHero(p.id);
    this.handlers.onChange(p);
    this.renderSwatches();
  }

  open(opener: HTMLElement | null = null) {
    this.opener = opener ?? (document.activeElement as HTMLElement | null);
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
