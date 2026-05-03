import type { Request, Response } from "express";
import { TtlCache, SessionRateLimiter } from "../cache.js";
import { getErrorExplanation, type TutorOutput } from "../tutor.js";
import { LEVELS } from "../levels.js";
import { explainBodySchema, formatZodErrors } from "../schemas.js";

const cache = new TtlCache<TutorOutput>(10 * 60 * 1000);
const limiter = new SessionRateLimiter(3_000);

export async function explainHandler(req: Request, res: Response) {
  const parsed = explainBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Bad request shape.", details: formatZodErrors(parsed.error) });
    return;
  }
  const body = parsed.data;

  const lvl = LEVELS.find((l) => l.id === body.levelId);
  if (!lvl) {
    res.status(404).json({ error: "Unknown level." });
    return;
  }

  const sessionId = (req.header("x-session-id") || req.ip || "anon").toString();
  const wait = limiter.check(sessionId);
  if (wait > 0) {
    res.status(429).json({
      text: `Hoot needs a breather. Try again in ${Math.ceil(wait / 1000)} seconds.`,
      source: "fallback",
    });
    return;
  }

  const key = `explain::${body.levelId}::${body.errorLine}::${hash(body.code)}::${hash(body.errorMessage)}`;
  const cached = cache.get(key);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const out = await getErrorExplanation({
      code: body.code,
      level: {
        id: lvl.id,
        name: lvl.name,
        intro: lvl.intro,
        allowedCommands: lvl.allowedCommands,
      },
      errorLine: body.errorLine,
      errorMessage: body.errorMessage,
    });
    cache.set(key, out);
    res.json(out);
  } catch (e) {
    console.error("[explain] unexpected error", e);
    res.status(500).json({ error: "Hoot can't think right now." });
  }
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}
