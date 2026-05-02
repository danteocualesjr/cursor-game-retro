import { Agent, CursorAgentError } from "@cursor/sdk";
import { createSandbox } from "./sandbox.js";
import {
  buildErrorPrompt,
  buildTutorPrompt,
  ERROR_SYSTEM,
  TUTOR_SYSTEM,
} from "./prompts.js";

export interface TutorInput {
  code: string;
  level: {
    id: number;
    name: string;
    intro: string;
    allowedCommands: string[];
  };
  errorLine?: number;
  errorMessage?: string;
}

export interface TutorOutput {
  text: string;
  source: "cursor-sdk" | "fallback";
  thinkingMs: number;
}

const MODEL = process.env.CURSOR_MODEL || "composer-2";

function hasApiKey(): boolean {
  return !!process.env.CURSOR_API_KEY && process.env.CURSOR_API_KEY !== "cursor_replace_me";
}

/**
 * Asks the Cursor agent for a kid-friendly hint on the current attempt.
 * Falls back to a canned message if no API key is configured or the SDK
 * raises a startup-time error.
 */
export async function getHint(input: TutorInput): Promise<TutorOutput> {
  if (!hasApiKey()) {
    return {
      text: fallbackHint(input),
      source: "fallback",
      thinkingMs: 0,
    };
  }
  return callAgent(input, "hint");
}

export async function getErrorExplanation(input: TutorInput): Promise<TutorOutput> {
  if (!hasApiKey()) {
    return {
      text: fallbackErrorHint(input),
      source: "fallback",
      thinkingMs: 0,
    };
  }
  return callAgent(input, "error");
}

async function callAgent(
  input: TutorInput,
  mode: "hint" | "error",
): Promise<TutorOutput> {
  const { dir, cleanup } = createSandbox(input);
  const start = Date.now();
  const apiKey = process.env.CURSOR_API_KEY!;
  const system = mode === "error" ? ERROR_SYSTEM : TUTOR_SYSTEM;
  const userPrompt = mode === "error" ? buildErrorPrompt() : buildTutorPrompt();
  // Prepend the system instructions to the prompt itself - no dependency on
  // an SDK option for system prompts existing.
  const fullPrompt = `${system}\n\n---\n\n${userPrompt}`;

  try {
    // `Agent.prompt()` is the one-shot pattern: it disposes its own resources,
    // perfect for stateless web requests like ours.
    const result = await Agent.prompt(fullPrompt, {
      apiKey,
      model: { id: MODEL },
      // Pin to local runtime + the per-request sandbox dir; never touch the
      // developer's personal Cursor settings.
      local: {
        cwd: dir,
        settingSources: [],
      },
    });

    if (result.status === "error") {
      // The agent ran but its run failed; degrade to a friendly canned hint.
      console.warn("[tutor] agent run failed", result);
      return {
        text:
          mode === "error" ? fallbackErrorHint(input) : fallbackHint(input),
        source: "fallback",
        thinkingMs: Date.now() - start,
      };
    }

    const text = sanitizeHint(result.result ?? "");
    return {
      text:
        text ||
        (mode === "error" ? fallbackErrorHint(input) : fallbackHint(input)),
      source: "cursor-sdk",
      thinkingMs: Date.now() - start,
    };
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.warn(
        "[tutor] CursorAgentError on startup",
        err.message,
        "retryable=" + err.isRetryable,
      );
      return {
        text:
          mode === "error" ? fallbackErrorHint(input) : fallbackHint(input),
        source: "fallback",
        thinkingMs: Date.now() - start,
      };
    }
    throw err;
  } finally {
    cleanup();
  }
}

/** Strip code fences, trim, collapse whitespace. */
function sanitizeHint(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`{1,3}/g, "")
    .replace(/^\s*Hint:\s*/i, "")
    .trim()
    .slice(0, 600);
}

// ----------------------------- FALLBACKS -----------------------------

const FALLBACK_HINTS: Record<number, string> = {
  1: "Look at which way the hero is facing. The goal is straight ahead. Try a single move() with how many tiles you need to walk.",
  2: "You'll need to walk forward, turn, then walk again. turnRight() rotates 90 degrees.",
  3: "All four sides of the loop look the same. Use repeat(4) so you don't write the same code over and over.",
  4: "After every move(1), check if you're standing on a gem with here(\"gem\"). Pick it up if you are.",
  5: "push() shoves the crate one tile. How many shoves does the crate need to land on the green switch?",
  6: "Same trick as level 4, but for a longer row. repeat(11) { move(1); if (here(\"gem\")) { pickUp(); } } is a great template.",
  7: "Pushing the crate forward is a sneaky way to defeat the slime. push() once, push() again, then walk to the goal.",
  8: "Try walking with while(sees(\"open\")) { ... } and pickUp() any time you stand on a gem. You'll need to turn at corners.",
};

function fallbackHint(input: TutorInput): string {
  const generic =
    "Read your code one line at a time and ask: what does the hero do here? What about the next line?";
  return FALLBACK_HINTS[input.level.id] ?? generic;
}

function fallbackErrorHint(input: TutorInput): string {
  if (input.errorLine === undefined) {
    return "Re-read your code from the top. Something the hero tried to do didn't work.";
  }
  const line = input.errorLine;
  const msg = input.errorMessage ?? "";
  if (/wall/i.test(msg)) {
    return `Line ${line}: the hero bonked into a wall. Try moving fewer tiles or turning first.`;
  }
  if (/pick up/i.test(msg) || /pickUp/.test(msg)) {
    return `Line ${line}: there's no gem on the hero's tile. Move onto a gem before pickUp().`;
  }
  if (/push/i.test(msg)) {
    return `Line ${line}: push() needs a crate right in front of the hero. Make sure you're facing the crate.`;
  }
  if (/slime/i.test(msg) || /attack/i.test(msg)) {
    return `Line ${line}: attack() needs a slime in front of the hero.`;
  }
  return `Line ${line}: read this line carefully. ${msg}`;
}
