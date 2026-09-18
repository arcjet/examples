import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
//#region src/cloudflare-think/v0/context.d.ts
/**
 * Structural source `cloudflareThinkContext` can read.
 *
 * Correlation is a **caller-owned** id from helper options or a bag the
 * integrator already has. This helper never mints a new id. It never
 * reads Think's SDK-minted `toolCallId`. It never reads `requestId`,
 * `traceId`, Durable Object `name` / `id`, or session auto-ids.
 *
 * Accepts:
 * - a caller-owned wrap `{ context: appContext }` for inbound
 *   `cloudflareThinkContext({ context })`
 * - the app context object itself
 * - helper `init.sessionId` / `init.correlationId`
 *
 * A `beforeToolCall` `ToolCallContext` looks like an envelope
 * (`toolName` + `toolCallId`) and is not mined for correlation.
 */
export interface CloudflareThinkContextSource {
  context?: unknown;
  correlationId?: unknown;
  sessionId?: unknown;
  conversationId?: unknown;
  /** Present on Think `ToolCallContext`. Never used for correlation. */
  toolCallId?: unknown;
  /** Present on Think `ToolCallContext`. Never used for correlation. */
  toolName?: unknown;
  /** Present on Think chat / turn results. Never used for correlation. */
  requestId?: unknown;
}
/**
 * Context derived from a Cloudflare Think run. `correlationId` is
 * omitted when nothing valid was present — this helper never mints one.
 */
export interface CloudflareThinkAgentContext {
  correlationId?: string;
  metadata?: ArcjetMetadata;
}
/**
 * Derive correlation and metadata from a caller-owned bag or helper
 * options. Never mints a new id. Never calls `createAgentContext`.
 * Never reads `toolCallId` (Think always generates it). Never reads
 * `requestId` / `traceId` / Durable Object `name` / `id`.
 *
 * Preference order for `correlationId`:
 * 1. Fields the integrator put on a caller-owned wrap
 *    (`cloudflareThinkContext({ context: appContext })`):
 *    `correlationId`, then `sessionId`, then `conversationId`
 * 2. Documented copies on a bare app object (not a tool-call envelope)
 * 3. `init.sessionId` / `init.correlationId` (a caller-owned fallback)
 *
 * Prefer `guardHooks({ sessionId })` or
 * `cloudflareThinkContext({ context: appContext })`. A
 * `beforeToolCall` context that has `toolName` and `toolCallId` is
 * treated as a Think envelope, so a top-level `sessionId` on that
 * object is ignored.
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
export declare function cloudflareThinkContext(source?: CloudflareThinkContextSource, init?: {
  sessionId?: string;
  correlationId?: string;
  metadata?: ArcjetMetadata;
}): CloudflareThinkAgentContext;
//#endregion