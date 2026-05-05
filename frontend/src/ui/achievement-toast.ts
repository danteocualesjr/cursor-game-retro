/**
 * Tiny achievement-unlock toast.
 *
 * Pushes a small badge into the top-right of the viewport when the
 * player earns a new achievement. Multiple toasts stack vertically;
 * each auto-dismisses after a few seconds. The first letter of the
 * badge name displays as a chunky pixel "monogram" on the left.
 */

import { achievementById } from "../game/achievements";

const CONTAINER_ID = "achievementToasts";

function ensureContainer(): HTMLElement {
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = CONTAINER_ID;
    el.className = "achievement-toasts";
    document.body.appendChild(el);
  }
  return el;
}

export function fireAchievementToast(id: string) {
  const def = achievementById(id);
  if (!def) return;
  const container = ensureContainer();
  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.innerHTML = `
    <div class="achievement-toast-monogram" aria-hidden="true">${escapeHtml(
      def.name[0],
    )}</div>
    <div class="achievement-toast-body">
      <div class="achievement-toast-label">ACHIEVEMENT UNLOCKED</div>
      <div class="achievement-toast-name">${escapeHtml(def.name)}</div>
      <div class="achievement-toast-desc">${escapeHtml(def.description)}</div>
    </div>
  `;
  container.appendChild(toast);
  // Force a reflow so the in animation has a frame to start from.
  void toast.offsetWidth;
  toast.classList.add("show");
  // Auto-dismiss after 4.5s; on hover, pause via CSS pointer-events.
  const dismiss = () => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 320);
  };
  setTimeout(dismiss, 4500);
  toast.addEventListener("click", dismiss);
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
