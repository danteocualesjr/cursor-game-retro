/**
 * Tiny dependency-free CSS-confetti burst.
 *
 * Spawns a fixed-position container that pins to the viewport, fills it
 * with N small colored pixel squares, animates each with a unique
 * fall-and-drift via CSS variables, then tears the container down once
 * the longest animation finishes. Honors prefers-reduced-motion by
 * doing nothing.
 *
 * Colors are pinned to the 80s arcade palette so the burst feels like
 * part of the cabinet, not a generic celebration.
 */

const CONFETTI_COLORS = [
  "#ff2e88", // hot magenta
  "#00f0ff", // electric cyan
  "#ffea00", // neon yellow
  "#39ff14", // NES green
  "#ff66d9", // light magenta
  "#f0f4ff", // off-white
];

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export interface ConfettiOptions {
  /** Number of pieces. Default 36. */
  count?: number;
  /** Total animation duration in ms. Default 1400. */
  durationMs?: number;
  /** DOM node to anchor the burst over. Defaults to document.body. */
  anchor?: HTMLElement | null;
}

export function fireConfetti(opts: ConfettiOptions = {}) {
  if (prefersReducedMotion()) return;
  const count = opts.count ?? 36;
  const durationMs = opts.durationMs ?? 1400;

  const root = document.createElement("div");
  root.className = "confetti";
  // Anchor over the supplied element (e.g. .game-pane) when given, else
  // pin to the full viewport. Both modes share the same per-piece CSS.
  if (opts.anchor) {
    const rect = opts.anchor.getBoundingClientRect();
    root.style.position = "fixed";
    root.style.left = `${rect.left}px`;
    root.style.top = `${rect.top}px`;
    root.style.width = `${rect.width}px`;
    root.style.height = `${rect.height}px`;
  }

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const startX = Math.random() * 100; // %
    const drift = (Math.random() * 60 - 30).toFixed(1); // % horizontal drift
    const delay = Math.floor(Math.random() * 200); // ms
    const dur = durationMs - 200 + Math.floor(Math.random() * 400);
    const size = 6 + Math.floor(Math.random() * 4); // 6-9px
    const rotate = Math.floor(Math.random() * 720) - 360;
    piece.style.setProperty("--c", color);
    piece.style.setProperty("--x", `${startX}%`);
    piece.style.setProperty("--drift", `${drift}%`);
    piece.style.setProperty("--dur", `${dur}ms`);
    piece.style.setProperty("--delay", `${delay}ms`);
    piece.style.setProperty("--size", `${size}px`);
    piece.style.setProperty("--rotate", `${rotate}deg`);
    root.appendChild(piece);
  }

  document.body.appendChild(root);
  window.setTimeout(() => root.remove(), durationMs + 300);
}
