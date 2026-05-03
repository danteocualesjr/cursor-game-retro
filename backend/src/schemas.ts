import { z } from "zod";

/**
 * Request schemas for the public HTTP API. Centralized here so the route
 * handlers stay focused on business logic, and so a future client codegen
 * step can read both shapes from one place.
 *
 * The frontend currently posts at most ~64KB JSON, so the limits here are
 * conservative defense-in-depth, not a tight contract.
 */

const codeSchema = z
  .string()
  .max(10_000, "Code is too long; the kid's code shouldn't exceed 10KB.");

const sessionIdSchema = z.string().max(128).optional();
export type SessionId = z.infer<typeof sessionIdSchema>;

const lastErrorSchema = z
  .object({
    line: z.number().int().min(1).max(10_000),
    message: z.string().max(2_000),
  })
  .optional();

export const hintBodySchema = z.object({
  levelId: z.number().int().min(1).max(999),
  levelName: z.string().min(1).max(120),
  intro: z.string().min(1).max(1_000),
  allowedCommands: z.array(z.string().min(1).max(40)).max(40),
  code: codeSchema,
  lastError: lastErrorSchema,
});
export type HintBody = z.infer<typeof hintBodySchema>;

export const explainBodySchema = z.object({
  levelId: z.number().int().min(1).max(999),
  code: codeSchema,
  errorLine: z.number().int().min(1).max(10_000),
  errorMessage: z.string().min(1).max(2_000),
});
export type ExplainBody = z.infer<typeof explainBodySchema>;

/**
 * Friendly summary of a Zod issue list, suitable for sending back to the
 * caller without leaking implementation details.
 */
export function formatZodErrors(err: z.ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}
