import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
//#region src/claude-managed-agents/v0/context.d.ts
/**
 * Caller-owned correlation for Claude Managed Agents.
 *
 * This helper never mints an id and never reads Anthropic session or event
 * ids (`sesn_…`, `sevt_…`, `agent.custom_tool_use.id`). Those are Anthropic's
 * identifiers, not ones we created. There is no `traceId`.
 */
interface ClaudeManagedAgentsContext {
  correlationId?: string;
  metadata?: ArcjetMetadata;
}
/**
 * Build correlation from a caller-owned id only.
 *
 * Preference: `init.correlationId` when it is a valid 1–256 printable-ASCII
 * string. An invalid value is dropped (and warned when `ARCJET_LOG_LEVEL`
 * asks for warnings). Anthropic session / event ids passed on any other
 * field are ignored. `traceId` is never read or written.
 *
 * @example
 * ```ts
 * import { claudeManagedAgentsContext } from "@arcjet/guard/claude-managed-agents/v0";
 *
 * // Conversation id the app minted — not session.id from Anthropic.
 * const ctx = claudeManagedAgentsContext({ correlationId: conversationId });
 * ```
 */
declare function claudeManagedAgentsContext(init?: {
  correlationId?: string;
  metadata?: ArcjetMetadata;
}): ClaudeManagedAgentsContext;
//#endregion
export { ClaudeManagedAgentsContext, claudeManagedAgentsContext };