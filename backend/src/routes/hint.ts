import type { Request, Response } from "express";
import { TtlCache, SessionRateLimiter } from "../cache.js";
import { getHint, type TutorOutput } from "../tutor.js";
import { formatZodErrors, hintBodySchema } from "../schemas.js";

const cache = new TtlCache<TutorOutput>(10 * 60 * 1000);
const limiter = new SessionRateLimiter(5_000);

export async function hintHandler(req: Request, res: Response) {
  const parsed = hintBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Bad request shape.", details: formatZodErrors(parsed.error) });
    return;
  }
  const body = parsed.data;

  const sessionId = (req.header("x-session-id") || req.ip || "anon").toString();
  const wait = limiter.check(sessionId);
  if (wait > 0) {
    res.status(429).json({
      text: `Hoot needs a breather. Try again in ${Math.ceil(wait / 1000)} seconds.`,
      source: "fallback",
      retryAfterMs: wait,
    });
    return;
  }

  const cacheKey = `hint::${body.levelId}::${hash(body.code)}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const out = await getHint({
      code: body.code,
      level: {
        id: body.levelId,
        name: body.levelName,
        intro: body.intro,
        allowedCommands: body.allowedCommands,
      },
      errorLine: body.lastError?.line,
      errorMessage: body.lastError?.message,
    });
    cache.set(cacheKey, out);
    res.json(out);
  } catch (e) {
    console.error("[hint] unexpected error", e);
    res.status(500).json({ error: "Hoot can't think right now." });
  }
}

/** Tiny non-cryptographic string hash. Plenty for a cache key. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}
