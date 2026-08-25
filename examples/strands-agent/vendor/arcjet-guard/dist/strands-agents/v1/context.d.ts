import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
//#region src/strands-agents/v1/context.d.ts
/**
 * Structural source `strandsAgentContext` can read.
 *
 * The SDK's `InvocationState` is a caller-owned `Record<string, unknown>`.
 * The core loop writes no keys into it. This helper reads a caller-owned
 * id from that bag (and documented copies on the envelope). It never
 * mints a new id. It never reads `traceId` (a typical OTel / SDK field
 * the docs mention as an example — still not ours). It never reads
 * `agent.id`. It never calls `SessionManager`.
 *
 * Accepts:
 * - the `invocationState` bag itself
 * - a tool / hook envelope (`{ invocationState }`, plus documented copies)
 */
interface StrandsContextSource {
  invocationState?: unknown;
  correlationId?: unknown;
  sessionId?: unknown;
  requestId?: unknown;
}
/**
 * Context derived from a Strands Agents invocation. `correlationId` is
 * omitted when nothing valid was present — this helper never mints one.
 */
interface StrandsAgentContext {
  correlationId?: string;
  metadata?: ArcjetMetadata;
}
/**
 * Derive correlation and metadata from a Strands `invocationState` bag
 * or a tool / hook envelope that carries one. Never mints a new id.
 * Never calls `createAgentContext`. Never reads `traceId`. Never reads
 * `agent.id`. Never calls `SessionManager`.
 *
 * Preference order for `correlationId`:
 * 1. Fields the integrator put on `invocationState`: `correlationId`,
 *    then `sessionId`, then `requestId`
 * 2. Documented copies on the envelope
 * 3. `init.sessionId` / `init.correlationId` (a caller-owned fallback)
 *
 * An invalid candidate is skipped (and warned when `ARCJET_LOG_LEVEL`
 * asks for warnings). If nothing valid remains, `correlationId` is
 * omitted so the decision is uncorrelated rather than joined to a
 * generated id nobody has.
 *
 * @example
 * ```ts
 * import { strandsAgentContext } from "@arcjet/guard/strands-agents/v1";
 *
 * const invocationState = { sessionId: conversationId };
 * export function beforeInvoke() {
 *   return strandsAgentContext({ invocationState });
 * }
 * ```
 */
declare function strandsAgentContext(source?: StrandsContextSource, init?: {
  sessionId?: string;
  correlationId?: string;
  metadata?: ArcjetMetadata;
}): StrandsAgentContext;
//#endregion
export { StrandsAgentContext, StrandsContextSource, strandsAgentContext };