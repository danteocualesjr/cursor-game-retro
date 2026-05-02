/**
 * Hoot the Owl: the in-game tutor's speech bubble.
 * The actual hint text comes from the backend (which calls the Cursor SDK).
 */
export class HootTutor {
  private root: HTMLElement;
  private bubble: HTMLElement;
  private hideTimer: number | null = null;

  constructor(rootSelector = "#hoot", bubbleSelector = "#hootBubble") {
    const root = document.querySelector<HTMLElement>(rootSelector);
    const bubble = document.querySelector<HTMLElement>(bubbleSelector);
    if (!root || !bubble) throw new Error("Hoot DOM not found");
    this.root = root;
    this.bubble = bubble;
  }

  show(text: string, opts: { thinking?: boolean; sticky?: boolean } = {}) {
    if (this.hideTimer) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.bubble.textContent = text;
    this.bubble.classList.toggle("thinking", !!opts.thinking);
    this.root.hidden = false;
    if (!opts.sticky && !opts.thinking) {
      this.hideTimer = window.setTimeout(() => this.hide(), 9000);
    }
  }

  hide() {
    if (this.hideTimer) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.root.hidden = true;
  }
}
