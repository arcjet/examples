import { DecisionDeny } from "../../types.js";
//#region src/openai-agents/v0/denial.d.ts
/**
 * Structured tool result returned to the model when a call is denied.
 *
 * Intentionally structurally identical to `vercel-ai/v7`'s, `mastra/v1`'s,
 * and `langgraph/v1`'s ArcjetDenialResult so the model trained on denial
 * objects sees the same shape regardless of which integration is in use.
 * Each declaration exists separately to avoid putting another vendor's SDK
 * in this namespace's import graph.
 *
 * **Why this is not a throw.** `tool({ execute })` without an `outputSchema`
 * installs a default `errorFunction` that turns a throw into
 * `"An error occurred while running the tool. Please try again. Error: …"`.
 * With an `outputSchema`, or with `errorFunction: null`, the throw is
 * rethrown as `ToolCallError` and the run dies. Neither path is a policy
 * denial the model can inspect. Returning a plain object is what `execute`
 * already does: the runner's `getToolCallOutputItem` stringifies it
 * (`toSmartString` / `JSON.stringify`) onto a `function_call_result` with
 * `status: "completed"`. The denial is in the payload
 * (`arcjetDenied: true`), not a fabricated envelope.
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