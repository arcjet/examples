import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
//#region src/tanstack-ai/v0/context.d.ts
/**
 * Structural source `tanstackAiContext` can read.
 *
 * Correlation is a **caller-owned** id from helper options or
 * `chat({ context })`. This helper never mints a new id. It never
 * reads TanStack's auto-generated `threadId` (or the deprecated
 * `conversationId` alias on `ChatMiddlewareContext`). It never reads
 * `traceId`, `requestId`, `streamId`, or `runId`.
 *
 * Accepts:
 * - `chat({ context })` / the user object on `ChatMiddlewareContext.context`
 * - a `ChatMiddlewareContext`-shaped envelope (only `context` is read)
 * - the app context object itself
 * - helper `init.sessionId` / `init.correlationId`
 */
interface TanStackAiContextSource {
  context?: unknown;
  correlationId?: unknown;
  sessionId?: unknown;
  conversationId?: unknown;
  /** Present on TanStack's middleware envelope. Never used for correlation. */
  requestId?: unknown;
  /** Present on TanStack's middleware envelope. Never used for correlation. */
  streamId?: unknown;
}
/**
 * Context derived from a TanStack AI `chat()` run. `correlationId` is
 * omitted when nothing valid was present — this helper never mints one.
 */
interface TanStackAiAgentContext {
  correlationId?: string;
  metadata?: ArcjetMetadata;
}
/**
 * Derive correlation and metadata from a TanStack AI `chat({ context })`
 * object or a `ChatMiddlewareContext`. Never mints a new id. Never
 * calls `createAgentContext`. Never reads `ctx.threadId` (TanStack
 * auto-generates it). Never reads `traceId` / `requestId` / `streamId`
 * / `runId`.
 *
 * Preference order for `correlationId`:
 * 1. Fields the integrator put on `chat({ context })`:
 *    `correlationId`, then `sessionId`, then `conversationId`
 * 2. Documented copies on a bare app object (not a middleware envelope)
 * 3. `init.sessionId` / `init.correlationId` (a caller-owned fallback)
 *
 * An invalid candidate is skipped (and warned when `ARCJET_LOG_LEVEL`
 * asks for warnings). If nothing valid remains, `correlationId` is
 * omitted so the decision is uncorrelated rather than joined to a
 * generated id nobody has.
 *
 * @example
 * ```ts
 * import { tanstackAiContext } from "@arcjet/guard/tanstack-ai/v0";
 *
 * const appContext = { sessionId: conversationId };
 * export function beforeChat() {
 *   return tanstackAiContext({ context: appContext });
 * }
 * ```
 */
declare function tanstackAiContext(source?: TanStackAiContextSource, init?: {
  sessionId?: string;
  correlationId?: string;
  metadata?: ArcjetMetadata;
}): TanStackAiAgentContext;
//#endregion
export { TanStackAiAgentContext, TanStackAiContextSource, tanstackAiContext };