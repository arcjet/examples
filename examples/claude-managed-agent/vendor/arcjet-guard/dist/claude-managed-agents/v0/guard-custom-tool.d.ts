import { ArcjetMetadata } from "../../metadata.js";
import { RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { ClaudeManagedAgentsContext } from "./context.js";
import { AgentCustomToolUseEvent, ManagedAgentsRunnableTool, UserCustomToolResultEventParams } from "./types.js";
//#region src/claude-managed-agents/v0/guard-custom-tool.d.ts
/**
 * Policy for `guardCustomTool()` — how to guard a hosted custom tool or a
 * self-hosted `betaTool({ run })`.
 */
interface GuardCustomToolPolicy<TInput = {
  [key: string]: unknown;
}> {
  /** Guard label and capture action: `"resource.verb"`, past tense. */
  action: string;
  /**
   * Rules to evaluate, static or computed from the tool input. Omitting this,
   * or returning `[]`, still submits a guard call.
   */
  rules?: RuleWithInput[] | ((input: TInput) => RuleWithInput[]);
  /** Metadata merged over the context's (object, or per-call function). */
  metadata?: ArcjetMetadata | ((input: TInput) => ArcjetMetadata);
  /**
   * Caller-owned correlation from `claudeManagedAgentsContext`. Never an
   * Anthropic session or event id.
   */
  context?: ClaudeManagedAgentsContext;
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
}
interface GuardCustomToolCall<TOutput> {
  event: AgentCustomToolUseEvent;
  execute: (input: {
    [key: string]: unknown;
  }) => Promise<TOutput>;
  /**
   * Sends a `user.custom_tool_result` via the real events API
   * (`sessions.events.send`). Called on deny / fail-closed so the session
   * does not idle forever. The allow path leaves sending the success result
   * to the caller after `execute` returns.
   */
  send: (result: UserCustomToolResultEventParams) => Promise<unknown>;
}
type GuardCustomToolResult<TOutput> = {
  allowed: true;
  output: TOutput;
} | {
  allowed: false;
  result: UserCustomToolResultEventParams;
};
/**
 * Run Guard **before** the app executes a custom tool.
 *
 * Hosted path: on `agent.custom_tool_use`, call this with `execute` + `send`.
 * On DENY the tool does not run and `send` is invoked with a real
 * `user.custom_tool_result` (`is_error: true`, error text). Anthropic has
 * already chosen the tool; this is the customer-side gate for tools **you**
 * execute. Built-in bash/read/write under default `always_allow` cannot be
 * gated. MCP tools Anthropic hosts cannot be gated here — Guard the MCP
 * servers you host.
 *
 * Self-hosted `EnvironmentWorker`: pass a `betaTool({ run })` (or any tool
 * with `run`) as the second argument to wrap `run` with the same gate. The
 * CLI worker cannot register custom tools.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import {
 *   claudeManagedAgentsContext,
 *   guardCustomTool,
 * } from "@arcjet/guard/claude-managed-agents/v0";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const limit = tokenBucket({
 *   refillRate: 10,
 *   intervalSeconds: 60,
 *   maxTokens: 10,
 * });
 *
 * if (event.type === "agent.custom_tool_use") {
 *   const gated = await guardCustomTool(
 *     arcjet,
 *     {
 *       event,
 *       execute: (input) => lookupOrder(input),
 *       send: (result) =>
 *         client.beta.sessions.events.send(session.id, { events: [result] }),
 *     },
 *     {
 *       action: "order.looked-up",
 *       rules: (input) => [limit({ key: String(input["orderNumber"]), requested: 1 })],
 *       context: claudeManagedAgentsContext({ correlationId: conversationId }),
 *     },
 *   );
 *   if (gated.allowed) {
 *     await client.beta.sessions.events.send(session.id, {
 *       events: [{
 *         type: "user.custom_tool_result",
 *         custom_tool_use_id: event.id,
 *         content: [{ type: "text", text: JSON.stringify(gated.output) }],
 *       }],
 *     });
 *   }
 * }
 * ```
 */
declare function guardCustomTool<TOutput>(client: ArcjetAgentClient, call: GuardCustomToolCall<TOutput>, policy: GuardCustomToolPolicy): Promise<GuardCustomToolResult<TOutput>>;
declare function guardCustomTool<TTool extends ManagedAgentsRunnableTool<any, any>>(client: ArcjetAgentClient, tool: TTool, policy: GuardCustomToolPolicy<Parameters<TTool["run"]>[0]>): TTool;
//#endregion
export { GuardCustomToolCall, GuardCustomToolPolicy, GuardCustomToolResult, guardCustomTool };