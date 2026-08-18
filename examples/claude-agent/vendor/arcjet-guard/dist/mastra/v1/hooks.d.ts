import { ArcjetMetadata } from "../../metadata.js";
import { RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { ToolHooks } from "@mastra/core/tools";
//#region src/mastra/v1/hooks.d.ts
/**
 * Input passed to `rules` / `metadata` / `action` callbacks on `guardHooks`.
 */
interface GuardHooksCall {
  toolName: string;
  input: unknown;
}
/**
 * Policy for `guardHooks()` — `{ beforeToolCall, afterToolCall }` for tools
 * this package did not wrap (`guardTool` is for authored `createTool` only).
 */
interface GuardHooksPolicy {
  /**
   * Guard label and capture action. Defaults to `"tool.invoked"`. May be a
   * function of the tool name and input.
   */
  action?: string | ((call: GuardHooksCall) => string);
  /**
   * Rules to evaluate before the tool runs. Omitting this still performs the
   * guard call.
   */
  rules?: RuleWithInput[] | ((call: GuardHooksCall) => RuleWithInput[]);
  /** Metadata merged over the derived Mastra context. */
  metadata?: ArcjetMetadata | ((call: GuardHooksCall) => ArcjetMetadata);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
}
/**
 * Mastra tool hooks that gate unwrapped tools (MCP, workspace, toolsets).
 *
 * `beforeToolCall` runs `guard()` and, on DENY, returns
 * `{ proceed: false, output }` so the tool does not execute and the model
 * receives a structured denial. `afterToolCall` captures the outcome and
 * never blocks.
 *
 * Use this for tools you did not pass through `guardTool`. Do not also wrap
 * the same authored tool with `@arcjet/guard/vercel-ai/v7`.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardHooks } from "@arcjet/guard/mastra/v1";
 * import { Agent } from "@mastra/core/agent";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const mcpLimit = tokenBucket({
 *   refillRate: 20,
 *   intervalSeconds: 60,
 *   maxTokens: 20,
 * });
 *
 * export const agent = new Agent({
 *   id: "support-agent",
 *   name: "support-agent",
 *   instructions: "Help the user.",
 *   model: "openai/gpt-4o",
 *   hooks: guardHooks(arcjet, {
 *     action: ({ toolName }) => `${toolName}.invoked`,
 *     rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
 *   }),
 * });
 * ```
 */
declare function guardHooks(client: ArcjetAgentClient, policy?: GuardHooksPolicy): ToolHooks;
//#endregion
export { GuardHooksCall, GuardHooksPolicy, guardHooks };