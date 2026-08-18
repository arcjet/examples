import { DecisionDeny } from "../../types.js";
//#region src/langgraph/v1/denial.d.ts
/**
 * Structured tool result returned to the model when a call is denied.
 *
 * Intentionally structurally identical to `vercel-ai/v7`'s ArcjetDenialResult
 * so the model trained on denial objects sees the same shape regardless of
 * which integration is in use. Both declarations exist to avoid putting the
 * `ai` SDK in this namespace's import graph.
 */
interface ArcjetDenialResult {
  arcjetDenied: true;
  /** Denial reason, e.g. `"RATE_LIMIT"` or `"PROMPT_INJECTION"`. */
  reason: string;
  /** Human/model-readable explanation of the denial. */
  message: string;
  /** Whether retrying later can succeed (true for rate limits). */
  retryable: boolean;
  /** Seconds until a rate-limited call may be retried. */
  retryAfterSeconds?: number;
}
/**
 * Tool-result shape `ToolNode` / the model can read on DENY.
 *
 * LangGraph's `ToolNode` treats a returned object with `getType() === "tool"`
 * as a `ToolMessage` and otherwise wraps the value in one with
 * `status: "success"`. This object carries `status: "error"` plus the
 * structured denial so either path is readable. We do not construct a
 * `@langchain/core` `ToolMessage` — that would be a value import, and CI
 * must pass with the peer absent.
 */
interface LangGraphToolResult extends ArcjetDenialResult {
  status: "error";
  content: string;
  type: "tool";
  name: string;
  tool_call_id: string;
  getType: () => "tool";
}
/** Model- and user-readable explanation of a denial. */
declare function deniedReason(decision: DecisionDeny): string;
/** Explanation used when the policy could not be evaluated. */
declare function unavailableReason(): string;
/**
 * Backoff hint returned to the model when the guard is unavailable.
 *
 * A rate-limit denial derives its hint from the denying rule's
 * `resetAtUnixSeconds`. This path has nothing to derive from. Five seconds
 * paces a model's retry loop.
 */
declare const UNAVAILABLE_RETRY_AFTER_SECONDS: number;
declare function denialResult(decision: DecisionDeny): ArcjetDenialResult;
declare function unavailableResult(): ArcjetDenialResult;
declare function denialToolResult(decision: DecisionDeny, extras?: {
  name?: string;
  toolCallId?: string;
}): LangGraphToolResult;
declare function unavailableToolResult(extras?: {
  name?: string;
  toolCallId?: string;
}): LangGraphToolResult;
/**
 * Lift a denial payload (or a caller `onDeny` object) into the tool-result
 * shape. A value that already looks like a tool result is returned as-is.
 */
declare function asToolResult(value: unknown, extras?: {
  name?: string;
  toolCallId?: string;
}): LangGraphToolResult;
//#endregion
export { ArcjetDenialResult, LangGraphToolResult, UNAVAILABLE_RETRY_AFTER_SECONDS, asToolResult, denialResult, denialToolResult, deniedReason, unavailableReason, unavailableResult, unavailableToolResult };