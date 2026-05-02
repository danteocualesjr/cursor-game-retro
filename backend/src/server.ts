import "dotenv/config";
import express from "express";
import cors from "cors";
import { hintHandler } from "./routes/hint.js";
import { explainHandler } from "./routes/explain.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    cursorSdk: !!process.env.CURSOR_API_KEY && process.env.CURSOR_API_KEY !== "cursor_replace_me",
    model: process.env.CURSOR_MODEL || "composer-2",
  });
});

app.post("/api/hint", (req, res) => {
  hintHandler(req, res).catch((err) => {
    console.error("[hint] handler crashed", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal error." });
  });
});

app.post("/api/explain-error", (req, res) => {
  explainHandler(req, res).catch((err) => {
    console.error("[explain] handler crashed", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal error." });
  });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  const hasKey =
    !!process.env.CURSOR_API_KEY &&
    process.env.CURSOR_API_KEY !== "cursor_replace_me";
  console.log(`[codequest] backend listening on http://localhost:${port}`);
  console.log(
    hasKey
      ? "[codequest] CURSOR_API_KEY detected: live tutor enabled"
      : "[codequest] no CURSOR_API_KEY: serving canned fallback hints",
  );
});
