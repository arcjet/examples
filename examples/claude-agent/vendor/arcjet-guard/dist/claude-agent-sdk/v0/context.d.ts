import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
//#region src/claude-agent-sdk/v0/context.d.ts
/**
 * Structural source `claudeAgentContext` can read. Accepts a Claude Agent SDK
 * hook input (`session_id`, optional `agent_id`) or an options-shaped object
 * (`sessionId`).
 */
interface ClaudeContextSource {
  session_id?: unknown;
  sessionId?: unknown;
  agent_id?: unknown;
  agent_type?: unknown;
}
/**
 * Context derived from a Claude Agent SDK session. `correlationId` is omitted
 * when neither hook `session_id` nor `options.sessionId` is a valid id — this
 * helper never mints one.
 */
interface ClaudeAgentContext {
  correlationId?: string;
  metadata?: ArcjetMetadata;
}
/**
 * Derive correlation and metadata from a Claude Agent SDK hook input or
 * `query({ options.sessionId })`. Never mints a new id.
 *
 * Preference order for `correlationId`:
 * 1. Hook input `session_id`
 * 2. Source `sessionId` (options-shaped objects)
 * 3. `init.sessionId` (`options.sessionId` passed explicitly)
 *
 * Subagent `agent_id` is metadata only. An invalid candidate is skipped (and
 * warned when `ARCJET_LOG_LEVEL` asks for warnings). If nothing valid remains,
 * `correlationId` is omitted so the decision is uncorrelated rather than
 * joined to a generated id nobody has.
 *
 * @example
 * ```ts
 * import { claudeAgentContext } from "@arcjet/guard/claude-agent-sdk/v0";
 *
 * export function fromHook(input: { session_id: string; agent_id?: string }) {
 *   return claudeAgentContext(input);
 * }
 * ```
 */
declare function claudeAgentContext(source?: ClaudeContextSource, init?: {
  sessionId?: string;
  metadata?: ArcjetMetadata;
}): ClaudeAgentContext;
//#endregion
export { ClaudeAgentContext, ClaudeContextSource, claudeAgentContext };