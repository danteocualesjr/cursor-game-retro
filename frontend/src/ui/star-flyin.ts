/**
 * "New best" star celebration: when the player earns a star they
 * didn't have before on the current level, we burst N pixel-art stars
 * from the canvas center and fly each one to the corresponding star-
 * dot in the level pill, where the pip lights up on contact. Uses the
 * Web Animations API so we can compute precise from/to coordinates at
 * runtime (the level pill's position depends on which level pill is
 * current, which the user can change).
 *
 * No-op under prefers-reduced-motion - the destination dot still
 * lights up because the regular renderPills() pass below us flips its
 * "earned" class. We just skip the flying animation.
 */

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Star glyph as inline SVG so it scales cleanly without a font. */
const STAR_SVG = `
<svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden="true">
  <polygon
    points="8,1 10,6 15,6.5 11,10 12,15 8,12.5 4,15 5,10 1,6.5 6,6"
    fill="#ffea00"
    stroke="#ff2e88"
    stroke-width="0.8"
    stroke-linejoin="miter"
  />
</svg>`.trim();

export interface FlyOptions {
  /** Number of stars to fly (1-3). */
  count: number;
  /** Element to start from (e.g. .game-pane). */
  source: HTMLElement;
  /** Element containing the destination star-dots. */
  destWrap: HTMLElement;
}

export function flyStars({ count, source, destWrap }: FlyOptions) {
  if (count <= 0) return;
  if (prefersReducedMotion()) return;

  const srcRect = source.getBoundingClientRect();
  const fromX = srcRect.left + srcRect.width / 2;
  const fromY = srcRect.top + srcRect.height / 2;

  const destDots = destWrap.querySelectorAll<HTMLElement>(".star-dot.earned");
  const destinations: { x: number; y: number; el: HTMLElement }[] = [];
  destDots.forEach((d) => {
    const r = d.getBoundingClientRect();
    destinations.push({
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      el: d,
    });
  });

  // Use the LAST `count` destinations - those are the newly-earned ones.
  const targets = destinations.slice(Math.max(0, destinations.length - count));

  targets.forEach((tgt, i) => {
    const star = document.createElement("div");
    star.className = "star-flyin";
    star.innerHTML = STAR_SVG;
    star.style.left = `${fromX - 24}px`;
    star.style.top = `${fromY - 24}px`;
    document.body.appendChild(star);

    const dx = tgt.x - fromX;
    const dy = tgt.y - fromY;
    const delay = 260 + i * 220;

    const anim = star.animate(
      [
        { transform: "translate(0,0) scale(0.2) rotate(0deg)", opacity: 0 },
        // Bounce up to full size and hover over the canvas.
        { transform: "translate(0, -32px) scale(1.4) rotate(180deg)", opacity: 1, offset: 0.25 },
        { transform: "translate(0, -8px) scale(1.2) rotate(360deg)", opacity: 1, offset: 0.5 },
        // Fly to the destination, shrinking down to pip-size.
        {
          transform: `translate(${dx}px, ${dy}px) scale(0.25) rotate(540deg)`,
          opacity: 1,
        },
      ],
      { duration: 1100, delay, easing: "cubic-bezier(.5,0,.4,1)", fill: "forwards" },
    );

    anim.onfinish = () => {
      // Pop the destination dot at landing for a satisfying click.
      tgt.el.classList.remove("star-dot-pop");
      void tgt.el.offsetWidth;
      tgt.el.classList.add("star-dot-pop");
      star.remove();
    };
  });
}
