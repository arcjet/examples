import { DecisionDeny } from "../../types.js";
//#region src/langgraph/v1/denial.d.ts
/**
 * Structured tool result returned to the model when a call is denied.
 *
 * Intentionally structurally identical to `vercel-ai/v7`'s and `mastra/v1`'s
 * ArcjetDenialResult so the model trained on denial objects sees the same
 * shape regardless of which integration is in use. Each declaration exists
 * separately to avoid putting another vendor's SDK in this namespace's import
 * graph.
 *
 * **Why this is not a `ToolMessage`.** `ToolNode` returns a tool's output
 * unchanged when `isBaseMessage(output)` holds, and otherwise wraps it in a
 * real `ToolMessage` carrying the tool call id. Passing that check needs a
 * `_getType` method, and an object that fakes it is then handed to
 * `messagesStateReducer`, which forwards anything `isBaseMessage` accepts and
 * assigns `m.lc_kwargs.id` — throwing on a duck-typed message and taking the
 * graph down. Constructing a genuine `ToolMessage` would need a value import
 * of `@langchain/core`, which this namespace must not have. So a denial is a
 * plain object: `ToolNode` wraps it, the model reads these fields as the tool
 * result content, and no graph internals are faked.
 *
 * A consequence worth knowing: because the tool does not throw, the
 * `ToolMessage` `ToolNode` builds carries `status: "success"`. The denial is
 * in the payload (`arcjetDenied: true`), not the envelope.
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
//#endregion
export { ArcjetDenialResult, UNAVAILABLE_RETRY_AFTER_SECONDS, denialResult, deniedReason, unavailableReason, unavailableResult };