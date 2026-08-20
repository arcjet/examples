import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
//#region src/genkit/v1/context.d.ts
/**
 * Structural source `genkitContext` can read.
 *
 * Tool handlers receive `{ context, interrupt, resumed }`. `generate()`
 * also takes `context`. This helper reads a caller-owned id from that
 * object (and documented copies on the envelope). It never mints a new
 * id. It never reads OpenTelemetry / Genkit `traceId`. It never treats
 * `interrupt` / `resumed` as correlation. It never reads
 * `session.sessionId` from a Session object — Genkit's Session mints a
 * UUID when constructed without one.
 *
 * Accepts:
 * - `generate({ context })` / a tool handler's `{ context, interrupt, resumed }`
 * - the `ActionContext` object itself
 * - envelope copies (`correlationId`, `sessionId`, `conversationId`,
 *   already-resolved `flowId` / `runId`)
 */
interface GenkitContextSource {
  context?: unknown;
  correlationId?: unknown;
  sessionId?: unknown;
  conversationId?: unknown;
  flowId?: unknown;
  runId?: unknown;
}
/**
 * Context derived from a Genkit generate / tool call. `correlationId` is
 * omitted when nothing valid was present — this helper never mints one.
 */
interface GenkitAgentContext {
  correlationId?: string;
  metadata?: ArcjetMetadata;
}
/**
 * Derive correlation and metadata from a Genkit `generate({ context })`
 * options object, a tool handler's `{ context, interrupt, resumed }`, or
 * a bare ActionContext. Never mints a new id. Never calls
 * `createAgentContext`. Never reads `traceId`. Never treats
 * `interrupt` / `resumed` as correlation.
 *
 * Preference order for `correlationId`:
 * 1. Fields the integrator put on `context`: `correlationId`, then
 *    `sessionId`, then `conversationId`
 * 2. Caller-owned flow / run id on `context` (`flowId`, then `runId`)
 *    — only if the caller put them there
 * 3. Documented copies on the envelope
 * 4. `init.sessionId` / `init.correlationId` (a caller-owned fallback)
 *
 * An invalid candidate is skipped (and warned when `ARCJET_LOG_LEVEL`
 * asks for warnings). If nothing valid remains, `correlationId` is
 * omitted so the decision is uncorrelated rather than joined to a
 * generated id nobody has.
 *
 * @example
 * ```ts
 * import { genkitContext } from "@arcjet/guard/genkit/v1";
 *
 * const appContext = { sessionId: conversationId };
 * export function beforeGenerate() {
 *   return genkitContext({ context: appContext });
 * }
 * ```
 */
declare function genkitContext(source?: GenkitContextSource, init?: {
  sessionId?: string;
  correlationId?: string;
  metadata?: ArcjetMetadata;
}): GenkitAgentContext;
//#endregion
export { GenkitAgentContext, GenkitContextSource, genkitContext };