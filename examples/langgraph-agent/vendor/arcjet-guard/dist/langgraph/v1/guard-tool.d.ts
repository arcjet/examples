import { ArcjetMetadata } from "../../metadata.js";
import { DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { LangGraphToolResult } from "./denial.js";
//#region src/langgraph/v1/guard-tool.d.ts
/**
 * Structural LangChain `tool()` / `StructuredTool` / `RunnableToolLike`.
 * Declared here so `guardTool` does not value-import `@langchain/core`.
 *
 * LangGraph Graph API tools are invoked via `invoke` (`ToolNode.runTool`)
 * and authored `tool()` wrappers also expose `func`. There is no `execute`.
 *
 * `createReactAgent` is deprecated in LangGraph JS v1 in favor of LangChain
 * `createAgent`. This helper targets Graph API tools, not that middleware.
 */
interface LangGraphTool<TInput = unknown> {
  name: string;
  description?: string;
  invoke?: (input: unknown, config?: unknown) => unknown;
  func?: (input: TInput, runtime?: unknown) => unknown;
}
/**
 * Input type of a LangGraph / LangChain structured tool. Used so `guardTool`
 * can keep the concrete tool type while still typing `policy.rules` against
 * the tool args (not opaque call ids).
 */
type LangGraphToolInput<TTool> = TTool extends {
  func?: (input: infer TInput, runtime?: unknown) => unknown;
} ? TInput : unknown;
/**
 * Policy for `guardTool()` — how to guard an authored LangChain `tool()` /
 * `StructuredTool`.
 *
 * Specifies the guard action name, optional rules to evaluate, metadata
 * context, and optional denial handler. Rules can be static or computed
 * from the tool's free-text args. Do not scan opaque ids.
 */
interface GuardToolPolicy<TInput> {
  /**
   * Guard label and capture action: `"resource.verb"`, past tense. A
   * function is resolved per call from the tool args (used by
   * `guardToolNode` so one policy can name many tools).
   */
  action: string | ((input: TInput) => string);
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
   * Return a `ToolMessage`-shaped object (`status: "error"` recommended) or
   * a plain object. Unavailable guards take the `onUnavailable` path
   * instead; this callback does not fire for outages.
   */
  onDeny?: (decision: DecisionDeny) => unknown;
}
/**
 * Wraps a LangChain `tool()` / `StructuredTool` so `func` / `invoke` never
 * runs on DENY.
 *
 * Always runs `guard()` before the tool, submitting `policy.rules` or none;
 * on DENY the original function never executes and the model receives a
 * tool result with `status: "error"` (or the result of `policy.onDeny`).
 * This helper does not throw on DENY.
 *
 * Guard API errors depend on `policy.onGuardError` (defaults to `"deny"`):
 * - `"deny"` (default): Tool does not execute; the model receives
 *   `status: "error"` with `reason: "ERROR"`.
 * - `"allow"`: Tool still runs, with a warning gated on `ARCJET_LOG_LEVEL`.
 *
 * Correlation is read from the invoke `config` / `ToolRuntime`
 * (`configurable.thread_id`). No id is minted.
 *
 * Do not also wrap the same tool with `@arcjet/guard/vercel-ai/v7` or pass
 * it through `guardToolNode` after wrapping — the shared
 * `arcjetProtectedTool` brand throws on a second `guardTool` wrap.
 * `guardToolNode` skips already-branded tools so Guard is not double-called.
 *
 * This is Graph API (`StateGraph` + `ToolNode`). `createReactAgent` is
 * deprecated in LangGraph JS v1; do not build on it. LangChain
 * `createAgent` / `wrapToolCall` is a later adapter.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardTool } from "@arcjet/guard/langgraph/v1";
 * import { tool } from "@langchain/core/tools";
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
 *   tool(
 *     async ({ orderNumber }) => ({ orderNumber, status: "shipped" }),
 *     {
 *       name: "lookup_order",
 *       description: "Look up an order by number",
 *       schema: z.object({ orderNumber: z.string() }),
 *     },
 *   ),
 *   {
 *     action: "order.looked-up",
 *     rules: (input) => [lookupLimit({ key: input.orderNumber, requested: 1 })],
 *   },
 * );
 * ```
 */
declare function guardTool<TTool extends LangGraphTool<any>>(client: ArcjetAgentClient, tool: TTool, policy: GuardToolPolicy<LangGraphToolInput<TTool>>): TTool;
//#endregion
export { GuardToolPolicy, LangGraphTool, LangGraphToolInput, type LangGraphToolResult, guardTool };