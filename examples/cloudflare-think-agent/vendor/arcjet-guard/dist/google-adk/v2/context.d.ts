import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
//#region src/google-adk/v2/context.d.ts
/**
 * Structural source `googleAdkContext` can read.
 *
 * Correlation is a **caller-owned** id from helper options or a bag the
 * integrator put on the run (`state`, a nested `context`, or a bare
 * object). This helper never mints a new id. It never reads ADK's
 * `invocationId` (always generated). It never reads `traceId`. It never
 * reads `functionCallId`. It never uses `toolContext.sessionId` /
 * `session.id` — those can be ephemeral / session-service auto-ids.
 *
 * Accepts:
 * - a `Context` / `toolContext` envelope (only session `state` is
 *   mined — ADK `Context` has no nested `context` field)
 * - a caller-owned wrap `{ context: appContext }` for inbound
 *   `googleAdkContext({ context })` (that `context` bag is not an ADK
 *   field)
 * - a session `state` bag (`toRecord()`, `get()`, or a plain object)
 * - the app context object itself
 * - helper `init.sessionId` / `init.correlationId` (wins over durable
 *   `state`)
 */
export interface GoogleAdkContextSource {
  context?: unknown;
  state?: unknown;
  correlationId?: unknown;
  sessionId?: unknown;
  conversationId?: unknown;
  /** Present on ADK `ReadonlyContext`. Never used for correlation. */
  invocationId?: unknown;
  /** Present on ADK tool context. Never used for correlation. */
  functionCallId?: unknown;
}
/**
 * Context derived from a Google ADK run. `correlationId` is omitted
 * when nothing valid was present — this helper never mints one.
 */
export interface GoogleAdkAgentContext {
  correlationId?: string;
  metadata?: ArcjetMetadata;
}
/**
 * Derive correlation and metadata from a Google ADK `toolContext`,
 * session `state`, or a caller-owned bag. Never mints a new id. Never
 * calls `createAgentContext`. Never reads `invocationId` (ADK always
 * generates it). Never reads `traceId` / `functionCallId`. Never reads
 * `toolContext.sessionId` / `session.id` (session auto-ids).
 *
 * Preference order for `correlationId`:
 * 1. Fields the integrator put on a caller-owned wrap
 *    (`googleAdkContext({ context: appContext })`):
 *    `correlationId`, then `sessionId`, then `conversationId`.
 *    ADK `Context` / `toolContext` has no such `context` field.
 * 2. `init.sessionId` / `init.correlationId` (helper options /
 *    `guardPlugin({ sessionId })`). This is the id for this helper and
 *    wins over durable session `state`.
 * 3. The same keys on session `state` (`toRecord()` / `get()` / object)
 * 4. Documented copies on a bare app object (not an ADK Context envelope)
 *
 * Prefer `guardPlugin({ sessionId })` or
 * `googleAdkContext({ context: appContext })`. Putting the id only on
 * `state` is a last resort — `state` persists across turns. A
 * `toolContext` that has `invocationId` is treated as an ADK envelope,
 * so a top-level `sessionId` on that object is ignored.
 *
 * An invalid candidate is skipped (and warned when `ARCJET_LOG_LEVEL`
 * asks for warnings). If nothing valid remains, `correlationId` is
 * omitted so the decision is uncorrelated rather than joined to a
 * generated id nobody has.
 *
 * @example
 * ```ts
 * import { googleAdkContext } from "@arcjet/guard/google-adk/v2";
 *
 * const appContext = { sessionId: conversationId };
 * export function beforeRun() {
 *   return googleAdkContext({ context: appContext });
 * }
 * ```
 */
export declare function googleAdkContext(source?: GoogleAdkContextSource, init?: {
  sessionId?: string;
  correlationId?: string;
  metadata?: ArcjetMetadata;
}): GoogleAdkAgentContext;
//#endregion