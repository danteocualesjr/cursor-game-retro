/**
 * Tiny chiptune SFX generator using the Web Audio API.
 * No samples, no assets - just oscillators and envelopes.
 *
 * The audio context is created lazily on the first user gesture (browser
 * autoplay policies require this).
 */

type Wave = "square" | "triangle" | "sawtooth" | "sine";

const MUTE_KEY = "codequest:muted";

function readMutedFromStorage(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

class ChiptuneAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = readMutedFromStorage();

  ensure() {
    if (this.ctx) return;
    try {
      const C = (window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext) as typeof AudioContext | undefined;
      if (!C) return;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  private beep(
    freq: number,
    durMs: number,
    wave: Wave = "square",
    vol = 1,
    glide?: number,
  ) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now);
    if (glide !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(glide, now + durMs / 1000);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durMs / 1000);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + durMs / 1000 + 0.02);
  }

  step() {
    this.beep(420, 60, "square", 0.5);
  }

  turn() {
    this.beep(560, 50, "square", 0.4);
  }

  bump() {
    this.beep(120, 140, "sawtooth", 0.7, 60);
  }

  pickup() {
    this.beep(880, 80, "square", 0.6);
    setTimeout(() => this.beep(1320, 120, "square", 0.6), 80);
  }

  push() {
    this.beep(220, 120, "triangle", 0.6);
  }

  attack() {
    this.beep(660, 80, "sawtooth", 0.6, 220);
  }

  error() {
    this.beep(180, 220, "sawtooth", 0.7, 90);
    setTimeout(() => this.beep(140, 240, "sawtooth", 0.6, 70), 100);
  }

  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) =>
      setTimeout(() => this.beep(n, 160, "square", 0.7), i * 110),
    );
  }
}

export const audio = new ChiptuneAudio();
