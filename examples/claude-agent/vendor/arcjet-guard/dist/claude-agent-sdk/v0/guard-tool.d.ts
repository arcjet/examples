import { ArcjetMetadata } from "../../metadata.js";
import { DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
//#region src/claude-agent-sdk/v0/guard-tool.d.ts
/**
 * Structural `tool()` definition. Declared here so `guardTool` does not
 * depend on the SDK's Zod schema parameter, which is not assignable across
 * `SdkMcpToolDefinition` / `SdkMcpToolDefinition<any>` under
 * `exactOptionalPropertyTypes`.
 */
interface ClaudeToolDefinition<TInput = unknown> {
  name: string;
  description: string;
  inputSchema: unknown;
  handler: (args: TInput, extra: unknown) => Promise<unknown>;
  annotations?: unknown;
  _meta?: Record<string, unknown>;
}
/**
 * Input type of a Claude Agent SDK `tool()` definition. Used so `guardTool`
 * can keep the concrete tool type while still typing `policy.rules` against
 * the handler args.
 */
type ClaudeToolInput<TTool> = TTool extends {
  handler: (args: infer TInput, extra: unknown) => Promise<unknown>;
} ? TInput : never;
/**
 * Policy for `guardTool()` — how to guard an authored `tool()` handler.
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
  /**
   * Fallback session id when the handler `extra` does not carry `session_id`.
   * Prefer `query({ options.sessionId })` plus hook input; this is the
   * authored-tool equivalent of that option. Never mint a new id here.
   */
  sessionId?: string | ((input: TInput) => string | undefined);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /**
   * Reshape the denial payload the model sees for a real DENY decision.
   * Return a `CallToolResult` (`isError: true` recommended) or a plain
   * object, which is placed on `structuredContent`. Unavailable guards take
   * the `onUnavailable` path instead; this callback does not fire for outages.
   */
  onDeny?: (decision: DecisionDeny) => unknown;
}
/**
 * Wraps an authored Claude Agent SDK `tool()` definition with guard-gated
 * execution.
 *
 * Always runs `guard()` before the handler, submitting `policy.rules` or none;
 * on DENY the handler never executes and the model receives a `CallToolResult`
 * with `isError: true` (or the result of `policy.onDeny`). This helper does
 * not throw on DENY.
 *
 * Guard API errors depend on `policy.onGuardError` (defaults to `"deny"`):
 * - `"deny"` (default): Handler does not execute; the model receives
 *   `isError: true` with `reason: "ERROR"`.
 * - `"allow"`: Handler still runs, with a warning gated on `ARCJET_LOG_LEVEL`.
 *
 * Correlation is read from the handler `extra` (`session_id`) or
 * `policy.sessionId`. No id is minted.
 *
 * Do not also wrap the same tool with `@arcjet/guard/vercel-ai/v7` or
 * `@arcjet/guard/agents`. Annotations and sandbox settings are not
 * enforcement — they do not replace this wrapper or `guardHooks`.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardTool } from "@arcjet/guard/claude-agent-sdk/v0";
 * import { tool } from "@anthropic-ai/claude-agent-sdk";
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
 *     "lookup_order",
 *     "Look up an order by number",
 *     { orderNumber: z.string() },
 *     async ({ orderNumber }) => ({
 *       content: [{ type: "text", text: `${orderNumber}: shipped` }],
 *     }),
 *   ),
 *   {
 *     action: "order.looked-up",
 *     rules: (input) => [lookupLimit({ key: input.orderNumber, requested: 1 })],
 *   },
 * );
 * ```
 */
declare function guardTool<TTool extends ClaudeToolDefinition<any>>(client: ArcjetAgentClient, tool: TTool, policy: GuardToolPolicy<ClaudeToolInput<TTool>>): TTool;
//#endregion
export { ClaudeToolDefinition, ClaudeToolInput, GuardToolPolicy, guardTool };