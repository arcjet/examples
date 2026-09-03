import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
//#region src/cloudflare-think/v0/context.d.ts
/**
 * Structural source `cloudflareThinkContext` can read.
 *
 * Correlation is a **caller-owned** id from helper options or a bag the
 * integrator put on the run. This helper never mints a new id. It never
 * reads Think's `toolCallId` (AI SDK minted). It never reads a Durable
 * Object `name` / `id`. It never reads `traceId`.
 *
 * Accepts:
 * - a caller-owned wrap `{ context: appContext }`
 * - the app context object itself
 * - helper `init.sessionId` / `init.correlationId`
 * - a `ToolCallContext`-shaped envelope (only a nested `context` bag is
 *   mined — `toolCallId` is ignored)
 */
interface CloudflareThinkContextSource {
  context?: unknown;
  correlationId?: unknown;
  sessionId?: unknown;
  conversationId?: unknown;
  /** Present on Think's `ToolCallContext`. Never used for correlation. */
  toolCallId?: unknown;
  /** Present on Think's `ToolCallContext`. Never used for correlation. */
  toolName?: unknown;
}
/**
 * Context derived from a Cloudflare Think run. `correlationId` is
 * omitted when nothing valid was present — this helper never mints one.
 */
interface CloudflareThinkAgentContext {
  correlationId?: string;
  metadata?: ArcjetMetadata;
}
/**
 * Derive correlation and metadata from a Cloudflare Think hook context
 * or a caller-owned bag. Never mints a new id. Never calls
 * `createAgentContext`. Never reads `toolCallId` (Think / AI SDK always
 * generates it). Never reads a Durable Object `name` / `id`. Never
 * reads `traceId`.
 *
 * Preference order for `correlationId`:
 * 1. Fields the integrator put on a caller-owned wrap
 *    (`cloudflareThinkContext({ context: appContext })`):
 *    `correlationId`, then `sessionId`, then `conversationId`
 * 2. Documented copies on a bare app object (not a Think tool-call envelope)
 * 3. `init.sessionId` / `init.correlationId` (a caller-owned fallback)
 *
 * Prefer `guardHooks({ sessionId })` or
 * `cloudflareThinkContext({ context: appContext })`. A `beforeToolCall`
 * context that has `toolCallId` and `toolName` is treated as a Think
 * envelope, so a top-level `sessionId` on that object is ignored.
 *
 * An invalid candidate is skipped (and warned when `ARCJET_LOG_LEVEL`
 * asks for warnings). If nothing valid remains, `correlationId` is
 * omitted so the decision is uncorrelated rather than joined to a
 * generated id nobody has.
 *
 * @example
 * ```ts
 * import { cloudflareThinkContext } from "@arcjet/guard/cloudflare-think/v0";
 *
 * const appContext = { sessionId: conversationId };
 * export function beforeChat() {
 *   return cloudflareThinkContext({ context: appContext });
 * }
 * ```
 */
declare function cloudflareThinkContext(source?: CloudflareThinkContextSource, init?: {
  sessionId?: string;
  correlationId?: string;
  metadata?: ArcjetMetadata;
}): CloudflareThinkAgentContext;
//#endregion
export { CloudflareThinkAgentContext, CloudflareThinkContextSource, cloudflareThinkContext };