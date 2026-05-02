# Codequest: Hoot's Adventure

A retro pixel-art coding game for kids (ages 8-12) where you write tiny lines of
code to guide a hero through grid-based puzzles. When you get stuck, **Hoot the
Owl** swoops in with a hint - powered by a real Cursor agent running on the
backend through the [Cursor SDK](https://cursor.com/docs/api/sdk/typescript).

```
+----------------------+      +-----------------------+      +-----------------+
| Browser (Vite + TS)  | <--> | Backend (Express)     | <--> | @cursor/sdk     |
| Canvas + CodeMirror  |      | /api/hint, /explain   |      | Agent.prompt()  |
+----------------------+      +-----------------------+      +-----------------+
```

## What kids learn

The in-game DSL is a tiny, friendly subset of "real" code:

```js
move(3);
turnLeft();
turnRight();
pickUp();
push();
repeat(4) { move(1); turnRight(); }
if (sees("gem")) { pickUp(); }
```

It introduces statements, function calls, arguments, loops, conditionals, and
sensing - the building blocks of programming - without forcing kids to wrestle
with full JavaScript syntax.

## How the AI tutor works

Every time the kid presses **HINT** (or their code throws), the frontend posts
the level + the kid's code to the backend. The backend writes those into a
sandbox directory, then calls `Agent.prompt()` from `@cursor/sdk`. The agent
reads the sandbox, then returns a kid-friendly nudge - never a full solution.

The Cursor API key lives only in the backend's `.env`. It never touches the
browser.

## Quickstart

```bash
# 1. Install all workspaces (frontend + backend)
npm install

# 2. Set up your key
cp .env.example .env
# then edit .env and put your CURSOR_API_KEY in

# 3. Run frontend + backend together
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:8787
```

If you don't have a Cursor API key yet, the game still runs end-to-end - the
HINT button just falls back to a small set of canned hints baked into the
backend.

## Project layout

```
cursor-game-retro/
  README.md
  package.json            # npm workspaces root
  .env.example            # CURSOR_API_KEY=...
  frontend/
    index.html
    src/
      main.ts             # boot
      styles.css          # NES palette + retro typography
      api.ts              # fetch wrappers for the backend
      game/
        engine.ts         # Canvas render loop
        grid.ts           # tile + level state
        hero.ts           # player entity
        interpreter.ts    # DSL tokenizer + parser + runtime
        levels.ts         # 8 hand-authored levels
        audio.ts          # WebAudio chiptune SFX
      ui/
        editor.ts         # CodeMirror integration
        tutor.ts          # Hoot the owl speech bubble
        hud.ts            # objective + level pills + status
  backend/
    src/
      server.ts           # Express boot
      routes/
        hint.ts           # POST /api/hint
        explain.ts        # POST /api/explain-error
        generate.ts       # POST /api/generate-level (stretch)
      tutor.ts            # @cursor/sdk wrapper
      sandbox.ts          # per-request workspace dir
      prompts.ts          # tutor system prompts
      cache.ts            # in-memory cache + rate limit
```

## Cost & latency notes

Each HINT or explain-error request triggers one `Agent.prompt()` run (model
defaults to `composer-2`). Expect a few seconds of latency and a small per-call
LLM cost - this is why the backend rate-limits to 1 hint per 5 seconds per
session and caches by `(code, levelId)`.

If you want to demo the game cheaply, leave `CURSOR_API_KEY` unset; the backend
will return canned hints instantly.

## Critical Cursor SDK practices baked in

These come straight from the [Cursor SDK skill](https://cursor.com/docs/api/sdk/typescript)
and are wired into [`backend/src/tutor.ts`](backend/src/tutor.ts):

- Uses `Agent.prompt()` for one-shot calls (auto-disposes resources).
- Passes `apiKey` explicitly from `process.env.CURSOR_API_KEY`.
- Pins `local: { cwd: sandboxDir, settingSources: [] }` so the tutor agent
  never reads the developer's personal Cursor settings.
- Distinguishes `CursorAgentError` (startup failure -> 500) from
  `result.status === "error"` (agent ran but failed -> graceful canned hint).

## Levels

| # | Name           | New concept introduced            |
|---|----------------|-----------------------------------|
| 1 | First Steps    | `move(n)`                         |
| 2 | About Face     | `turnLeft()` / `turnRight()`      |
| 3 | Around Again   | `repeat(n) { ... }`               |
| 4 | Shiny Things   | `if (sees("gem")) { pickUp(); }`  |
| 5 | Heave-Ho       | `push()` boxes onto switches      |
| 6 | Gem Sweep      | combine `repeat` + `if`           |
| 7 | Slime Time     | mini-boss with `push` + `attack`  |
| 8 | Free Play      | open puzzle, any solution wins    |

## Stretch ideas (not in v1)

- Procedural level generation via a separate `Agent.prompt()` call.
- "Explain my code" button that narrates a kid's program before they run it.
- Persist progress to `localStorage` and add stars per level.
- Multiple worlds (forest, dungeon, space) with palette swaps.

## License

MIT.
