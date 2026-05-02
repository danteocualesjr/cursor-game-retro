/**
 * Thin wrappers around the backend's HTTP endpoints.
 * Always returns a `text` field so the caller can render a hint, even when
 * the backend falls back to a canned message.
 */

const SESSION_ID_KEY = "codequest:session";

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id =
      "s_" +
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36).slice(-4);
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export interface HintRequest {
  levelId: number;
  levelName: string;
  intro: string;
  allowedCommands: string[];
  code: string;
  lastError?: { line: number; message: string };
}

export interface HintResponse {
  text: string;
  source: "cursor-sdk" | "fallback";
  thinkingMs?: number;
}

export async function requestHint(req: HintRequest): Promise<HintResponse> {
  const res = await fetch("/api/hint", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-session-id": getSessionId(),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Hoot can't think right now (${res.status}). ${msg}`);
  }
  return (await res.json()) as HintResponse;
}

export async function explainError(req: {
  levelId: number;
  code: string;
  errorLine: number;
  errorMessage: string;
}): Promise<HintResponse> {
  const res = await fetch("/api/explain-error", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-session-id": getSessionId(),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Hoot can't think right now (${res.status}). ${msg}`);
  }
  return (await res.json()) as HintResponse;
}
