import { ArcjetMetadata } from "../../metadata.js";
import { DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { ToolDefinition } from "eve/tools";
//#region src/vercel-eve/v0/guard-tool.d.ts
/**
 * Policy for `guardTool()` — how to guard an authored tool's execution.
 *
 * Specifies the guard action name, optional rules to evaluate, metadata
 * context, and optional denial handler. Rules can be static or computed
 * from the tool's input.
 */
interface GuardToolPolicy<TInput> {
  /** Guard label and capture action: `"resource.verb"`, past tense. */
  action: string;
  /** Rules to evaluate, static or computed from the tool's input. */
  rules?: RuleWithInput[] | ((input: TInput) => RuleWithInput[]);
  /** Metadata merged over the context's. */
  metadata?: ArcjetMetadata | ((input: TInput) => ArcjetMetadata);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /**
   * Reshape what a denial does. Defaults to throwing `ArcjetDeniedError`.
   * With `"result"`, a denial resolves to an `ArcjetDenialResult` object that
   * the model receives as the tool's return value. The model can then inspect
   * `reason`, `message`, and `retryable` to decide whether to retry, explain
   * the denial to the user, or try a different approach.
   *
   * **Warning:** This is safe only when the locally-executed tool does not
   * declare an `outputSchema` that would reject it, or when you have verified
   * the schema accepts the denial result structure. Schema validation in the
   * AI SDK is deferred to message-persistence boundaries (`validateUIMessages`),
   * not the tool loop, so a denial object can traverse the tool loop safely;
   * a later `validateUIMessages()` call over persisted UI history would reject it
   * if the tool declares an `outputSchema` that does not include `ArcjetDenialResult`.
   */
  onDeny?: ((decision: DecisionDeny) => unknown) | "result";
}
/**
 * Wraps an authored Eve tool with guard-gated execution and event capture.
 *
 * Always runs `guard()` before the tool, submitting `policy.rules` or none; on
 * DENY the tool never executes and the wrapper throws `ArcjetDeniedError`
 * (or returns the result of `policy.onDeny`). On ALLOW — which is what
 * submitting no rules returns — the tool runs and the outcome is captured.
 *
 * The returned definition carries both of Eve's stamped symbols: the enumerable
 * `eve:tool-brand` and the non-enumerable `eve.definition-source-key` that
 * `toolResultFrom` uses to match results to their definition in channel
 * handlers. Both are preserved; a plain object spread would lose the second one.
 *
 * Guard API errors behavior depends on `policy.onGuardError` (defaults to `"deny"`):
 * - `"deny"` (default): Tool does not execute; an `ArcjetGuardUnavailableError` is thrown.
 * - `"allow"`: Tool still runs, with a warning gated on `ARCJET_LOG_LEVEL`.
 *
 * Unlike `guardApproval`, this helper **may** throw: a thrown denial or unavailable
 * error reaches Eve, which projects it as `action.result` with `status: "failed"`
 * and an `ActionResultError`. Reach for `guardApproval` instead when the tool
 * declares an `outputSchema` or comes from a connection — a tool that declares an
 * output contract should not silently return something else.
 *
 * **Limitation:** Static authored tools are supported; dynamically-defined tools
 * (`defineDynamic`) are not, because their `execute` functions are hoisted by
 * a compiler pass that would not see through the wrapper.
 *
 * @param client - Guard client from `launchArcjet()`
 * @param tool - The authored tool to wrap; must have an `execute` function
 * @param policy - Execution policy: `action` (required), `rules`, `metadata`, `onGuardError`, `onDeny`
 * @returns A tool with protected `execute`, preserving both Eve symbols
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardTool } from "@arcjet/guard/vercel-eve/v0";
 * import { defineTool } from "eve/tools";
 * import type { ToolDefinition } from "eve/tools";
 *
 * const arcjetClient = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 *
 * const emailLimit = tokenBucket({
 *   refillRate: 5,
 *   intervalSeconds: 60,
 *   maxTokens: 5,
 * });
 *
 * const sendEmail = defineTool<{ to: string }, { messageId: string }>({
 *   description: "Send an email",
 *   inputSchema: {
 *     type: "object",
 *     properties: { to: { type: "string" } },
 *     required: ["to"],
 *   },
 *   execute: async (input) => ({ messageId: `msg-for-${input.to}` }),
 * });
 *
 * // A denial throws ArcjetDeniedError, which Eve projects as a failed
 * // `action.result`. Reach for `guardApproval` instead when the tool declares
 * // an `outputSchema` or comes from a connection.
 * const protectedEmail: ToolDefinition<{ to: string }, { messageId: string }> =
 *   guardTool(arcjetClient, sendEmail, {
 *     action: "email.sent",
 *     onGuardError: "deny", // default — blocks the call if Arcjet is unreachable
 *     rules: (input) => [emailLimit({ key: input.to, requested: 1 })],
 *   });
 *
 * export default protectedEmail;
 * ```
 */
declare function guardTool<TInput, TOutput>(client: ArcjetAgentClient, tool: ToolDefinition<TInput, TOutput>, policy: GuardToolPolicy<TInput>): ToolDefinition<TInput, TOutput>;
//#endregion
export { GuardToolPolicy, guardTool };