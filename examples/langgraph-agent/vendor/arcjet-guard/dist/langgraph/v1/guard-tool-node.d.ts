import { ArcjetMetadata } from "../../metadata.js";
import { DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { LangGraphTool } from "./guard-tool.js";
//#region src/langgraph/v1/guard-tool-node.d.ts
/**
 * Input passed to `rules` / `metadata` / `action` callbacks on
 * `guardToolNode`. `input` is the tool's free-text args, not the opaque
 * `tool_call_id`.
 */
interface GuardToolNodeCall {
  toolName: string;
  input: unknown;
}
/**
 * Policy for `guardToolNode()` — how to guard unwrapped / MCP /
 * runtime-discovered tools that execute through `ToolNode`.
 *
 * `createReactAgent` is deprecated in LangGraph JS v1; this helper wraps
 * `ToolNode` from `@langchain/langgraph/prebuilt`, not that API. LangGraph
 * `interrupt()` / `interrupt_before=["tools"]` is HITL, not a policy gate
 * — there is no `guardInterrupt`.
 */
interface GuardToolNodePolicy {
  /**
   * Guard label and capture action. Defaults to `"tool.invoked"`. May be a
   * function of the tool name and args.
   */
  action?: string | ((call: GuardToolNodeCall) => string);
  /**
   * Rules to evaluate before an unwrapped tool runs. Omitting this still
   * performs the guard call.
   */
  rules?: RuleWithInput[] | ((call: GuardToolNodeCall) => RuleWithInput[]);
  /** Metadata merged over the derived LangGraph context. */
  metadata?: ArcjetMetadata | ((call: GuardToolNodeCall) => ArcjetMetadata);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /**
   * Reshape the denial payload the model sees for a real DENY decision.
   * Unavailable guards take the `onUnavailable` path instead.
   */
  onDeny?: (decision: DecisionDeny) => unknown;
}
/**
 * Structural `ToolNode` surface this helper wraps. Matches
 * `@langchain/langgraph/prebuilt` `ToolNode` (`tools` + `invoke`) without
 * constructing one — CI must pass with the peer absent.
 */
interface LangGraphToolNodeLike {
  tools: LangGraphTool[];
  invoke: (input: unknown, config?: unknown) => unknown;
}
/**
 * Wraps a LangGraph `ToolNode` (or the tools you will pass to one) so MCP /
 * runtime-discovered / unwrapped tools still hit Guard before execute.
 *
 * Already-branded tools (`guardTool`) are left alone so Guard is not
 * double-called. Wrapping a `ToolNode` that is already branded throws.
 *
 * Prefer this for tools that only run through `ToolNode`. Use `guardTool`
 * for authored tools invoked outside `ToolNode`.
 *
 * `interrupt()` / `interrupt_before=["tools"]` is HITL, not a policy gate.
 * Graph hooks cannot enforce a deny — `ToolNode` (or `guardTool`) is the
 * deny point.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardToolNode } from "@arcjet/guard/langgraph/v1";
 * import { ToolNode } from "@langchain/langgraph/prebuilt";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const mcpLimit = tokenBucket({
 *   refillRate: 20,
 *   intervalSeconds: 60,
 *   maxTokens: 20,
 * });
 *
 * const tools = guardToolNode(
 *   arcjet,
 *   new ToolNode(mcpTools),
 *   {
 *     action: ({ toolName }) => `${toolName}.invoked`,
 *     rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
 *   },
 * );
 * ```
 */
declare function guardToolNode<T extends LangGraphToolNodeLike>(client: ArcjetAgentClient, node: T, policy?: GuardToolNodePolicy): T;
declare function guardToolNode<T extends LangGraphTool>(client: ArcjetAgentClient, tools: readonly T[], policy?: GuardToolNodePolicy): T[];
//#endregion
export { GuardToolNodeCall, GuardToolNodePolicy, LangGraphToolNodeLike, guardToolNode };