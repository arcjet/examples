import { ArcjetMetadata } from "../../metadata.js";
import { DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { AgentMiddleware } from "langchain";
//#region src/langchain/v1/guard-middleware.d.ts
/**
 * Input passed to `rules` / `metadata` / `action` callbacks on
 * `guardMiddleware`. `input` is the tool's free-text args, not the
 * opaque `toolCall.id`.
 */
interface GuardMiddlewareCall {
  toolName: string;
  input: unknown;
}
/**
 * Policy for `guardMiddleware()` — how to guard tools that execute
 * through `createAgent({ middleware })`, including MCP tools,
 * runtime-discovered tools, and anything not wrapped with `guardTool`.
 *
 * `humanInTheLoopMiddleware` / `interrupt()` is HITL, not a policy
 * gate — this helper never calls `interrupt()` and never installs an
 * `afterModel` hook.
 */
interface GuardMiddlewarePolicy {
  /**
   * Guard label and capture action. Defaults to `"tool.invoked"`. May be a
   * function of the tool name and args.
   */
  action?: string | ((call: GuardMiddlewareCall) => string);
  /**
   * Rules to evaluate before an unwrapped tool runs. Omitting this still
   * performs the guard call.
   */
  rules?: RuleWithInput[] | ((call: GuardMiddlewareCall) => RuleWithInput[]);
  /** Metadata merged over the derived LangChain context. */
  metadata?: ArcjetMetadata | ((call: GuardMiddlewareCall) => ArcjetMetadata);
  /**
   * Fallback session id when `runtime.configurable.thread_id` is absent.
   * Prefer putting the id you already chose on
   * `agent.invoke(..., { configurable: { thread_id } })`. Never mint a
   * new id here.
   */
  sessionId?: string | ((call: GuardMiddlewareCall) => string | undefined);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /**
   * Reshape the denial payload JSON-stringified onto the completed
   * `ToolMessage.content` for a real DENY decision. Unavailable guards
   * take the `onUnavailable` path instead.
   */
  onDeny?: (decision: DecisionDeny) => unknown;
}
/**
 * The `createMiddleware`-shaped result this helper returns.
 *
 * This is LangChain's `AgentMiddleware` (via `import type` only — this
 * module never value-imports `createMiddleware`). `createAgent({
 * middleware })` accepts it with no cast.
 */
type LangChainGuardMiddleware = AgentMiddleware & {
  wrapToolCall: NonNullable<AgentMiddleware["wrapToolCall"]>;
};
/**
 * A `createAgent({ middleware })` middleware whose `wrapToolCall` is
 * the invoke()-wide gate.
 *
 * MCP tools, runtime-discovered tools, and anything not wrapped with
 * `guardTool` skip the authored handler. This is the Genkit
 * `guardMiddleware` / LangGraph `guardToolNode` equivalent. Put it on
 * `createAgent({ middleware: [guardMiddleware(...)] })`.
 *
 * `wrapToolCall` *can* deny: LangChain's official auth example returns
 * a `ToolMessage` without calling `handler`. This helper does that.
 * The return is validated with `ToolMessage.isInstance` and is **not**
 * passed through `baseHandler`, so a bare object is the
 * messages-reducer crash. This helper does **not** throw (throws
 * bubble and drop `arcjetDenied`) and does **not** set
 * `status: "error"` (the denial lives in `content`). Policy sits on
 * `wrapToolCall` only — `afterModel` is where HITL already lives.
 *
 * Already-branded tools (`guardTool`) are skipped when
 * `request.tool` can be looked up, so Guard is not double-called.
 * Tools that cannot be looked up (`request.tool` undefined — MCP /
 * unwrapped / runtime-discovered) are still gated.
 *
 * Correlation is read from `request.runtime.configurable.thread_id`
 * (langchain >= 1.2.34). No id is minted.
 *
 * Server-side provider tools and headless `.implement()` tools are
 * out of scope.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardMiddleware } from "@arcjet/guard/langchain/v1";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const mcpLimit = tokenBucket({
 *   refillRate: 20,
 *   intervalSeconds: 60,
 *   maxTokens: 20,
 * });
 *
 * const agent = createAgent({
 *   model,
 *   tools: [lookupOrder, ...mcpTools],
 *   middleware: [
 *     guardMiddleware(arcjet, {
 *       action: ({ toolName }) => `${toolName}.invoked`,
 *       rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
 *       sessionId: conversationId,
 *     }),
 *   ],
 * });
 * ```
 */
declare function guardMiddleware(client: ArcjetAgentClient, policy?: GuardMiddlewarePolicy): LangChainGuardMiddleware;
//#endregion
export { GuardMiddlewareCall, GuardMiddlewarePolicy, LangChainGuardMiddleware, guardMiddleware };