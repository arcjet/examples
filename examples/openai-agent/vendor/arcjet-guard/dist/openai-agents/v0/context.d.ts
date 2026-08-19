import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
//#region src/openai-agents/v0/context.d.ts
/**
 * Structural source `openaiAgentsContext` can read.
 *
 * `RunContext` itself has no session / conversation / thread id. Its public
 * fields are `context` (the app object from `run(..., { context })`),
 * `usage`, and `toolInput` (asTool only). This helper never reads a
 * fabricated `runContext.conversationId`, and never reads `traceId`
 * (the SDK mints one when omitted).
 *
 * Accepts:
 * - a `RunContext`-shaped object (`{ context: app }`)
 * - the app context object itself
 * - run options / `RunConfig` copies (`conversationId`, `groupId`,
 *   already-resolved `sessionId`)
 *
 * Do not pass a `Session` and expect `getSessionId()` to be called:
 * `MemorySession` mints a UUID when constructed without `sessionId`.
 * Resolve the id you already chose (`await session.getSessionId()`) and
 * put that string on `context` or on this source.
 */
interface OpenAIAgentsContextSource {
  context?: unknown;
  conversationId?: unknown;
  groupId?: unknown;
  sessionId?: unknown;
  correlationId?: unknown;
}
/**
 * Context derived from an OpenAI Agents run. `correlationId` is omitted
 * when nothing valid was present — this helper never mints one.
 */
interface OpenAIAgentsAgentContext {
  correlationId?: string;
  metadata?: ArcjetMetadata;
}
/**
 * Derive correlation and metadata from an OpenAI Agents `RunContext`, app
 * context, or run-options copy. Never mints a new id. Never calls
 * `createAgentContext`. Never calls `session.getSessionId()`.
 *
 * Preference order for `correlationId`:
 * 1. Fields the integrator put on `runContext.context` (or a bare app
 *    object): `correlationId`, then `sessionId`, then `conversationId`,
 *    then `groupId`
 * 2. Documented copies on the envelope: run option `conversationId`,
 *    `RunConfig.groupId`, already-resolved `sessionId`
 * 3. `init.sessionId` / `init.correlationId` (a caller-owned fallback)
 *
 * `traceId` is never read. An invalid candidate is skipped (and warned
 * when `ARCJET_LOG_LEVEL` asks for warnings). If nothing valid remains,
 * `correlationId` is omitted so the decision is uncorrelated rather than
 * joined to a generated id nobody has.
 *
 * @example
 * ```ts
 * import { openaiAgentsContext } from "@arcjet/guard/openai-agents/v0";
 *
 * const appContext = { sessionId: conversationId };
 * export function beforeRun() {
 *   return openaiAgentsContext({ context: appContext, conversationId });
 * }
 * ```
 */
declare function openaiAgentsContext(source?: OpenAIAgentsContextSource, init?: {
  sessionId?: string;
  correlationId?: string;
  metadata?: ArcjetMetadata;
}): OpenAIAgentsAgentContext;
//#endregion
export { OpenAIAgentsAgentContext, OpenAIAgentsContextSource, openaiAgentsContext };