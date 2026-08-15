import { ArcjetMetadata } from "../../metadata.js";
import { DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { ToolAction } from "@mastra/core/tools";
//#region src/mastra/v1/guard-tool.d.ts
/**
 * Input type of a Mastra `ToolAction`. Used so `guardTool` can keep the
 * concrete tool type while still typing `policy.rules` against the tool input.
 */
type MastraToolInput<TTool> = TTool extends ToolAction<infer TInput, any> ? TInput : never;
/**
 * Output type of a Mastra `ToolAction`.
 */
type MastraToolOutput<TTool> = TTool extends ToolAction<any, infer TOutput> ? TOutput : never;
/**
 * Policy for `guardTool()` — how to guard a Mastra `createTool({ execute })`.
 *
 * Specifies the guard action name, optional rules to evaluate, metadata
 * context, and optional denial handler. Rules can be static or computed
 * from the tool's input.
 */
interface GuardToolPolicy<TInput> {
  /** Guard label and capture action: `"resource.verb"`, past tense. */
  action: string;
  /**
   * Rules to evaluate, static or computed from the tool's input. Omitting
   * this, or returning `[]`, submits no rules — it does not skip the guard
   * call, which still costs a round trip and returns a decision.
   */
  rules?: RuleWithInput[] | ((input: TInput) => RuleWithInput[]);
  /** Metadata merged over the context's (object, or per-call function of the tool input). */
  metadata?: ArcjetMetadata | ((input: TInput) => ArcjetMetadata);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /**
   * Reshape the denial payload the model sees for a real DENY decision.
   * Unavailable guards take the `onUnavailable` path instead and return the
   * fixed `{ reason: "ERROR", retryable: true, retryAfterSeconds: 5 }` result;
   * this callback does not fire for outages.
   *
   * **Warning:** A denial object can traverse the tool loop even when the tool
   * declares an `outputSchema` that would reject it. Prefer omitting
   * `outputSchema` on guarded tools, or verify the schema accepts
   * `ArcjetDenialResult`.
   */
  onDeny?: (decision: DecisionDeny) => unknown;
}
/**
 * Wraps a Mastra `createTool({ execute })` with guard-gated execution.
 *
 * Always runs `guard()` before the tool, submitting `policy.rules` or none; on
 * DENY the tool never executes and the model receives an `ArcjetDenialResult`
 * (or the result of `policy.onDeny`). This helper does not throw on DENY.
 *
 * Guard API errors depend on `policy.onGuardError` (defaults to `"deny"`):
 * - `"deny"` (default): Tool does not execute; the model receives an
 *   `ArcjetDenialResult` with `reason: "ERROR"`.
 * - `"allow"`: Tool still runs, with a warning gated on `ARCJET_LOG_LEVEL`.
 *
 * Correlation is read from the tool's execution context (`requestContext`,
 * `agent.threadId` / `resourceId`, `workflow.runId`). No id is minted.
 *
 * Do not also wrap the same tool with `@arcjet/guard/vercel-ai/v7`.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardTool } from "@arcjet/guard/mastra/v1";
 * import { createTool } from "@mastra/core/tools";
 * import { z } from "zod";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const lookupLimit = tokenBucket({
 *   refillRate: 10,
 *   intervalSeconds: 60,
 *   maxTokens: 10,
 * });
 *
 * export const lookupOrder = guardTool(
 *   arcjet,
 *   createTool({
 *     id: "lookup-order",
 *     description: "Look up an order by number",
 *     inputSchema: z.object({ orderNumber: z.string() }),
 *     execute: async ({ orderNumber }) => ({ orderNumber, status: "shipped" }),
 *   }),
 *   {
 *     action: "order.looked-up",
 *     rules: (input) => [lookupLimit({ key: input.orderNumber, requested: 1 })],
 *   },
 * );
 * ```
 */
declare function guardTool<TTool extends ToolAction<any, any>>(client: ArcjetAgentClient, tool: TTool, policy: GuardToolPolicy<MastraToolInput<TTool>>): TTool;
//#endregion
export { GuardToolPolicy, MastraToolInput, MastraToolOutput, guardTool };