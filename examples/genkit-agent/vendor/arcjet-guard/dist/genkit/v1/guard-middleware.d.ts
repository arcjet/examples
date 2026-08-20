import { ArcjetMetadata } from "../../metadata.js";
import { DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
//#region src/genkit/v1/guard-middleware.d.ts
/**
 * Input passed to `rules` / `metadata` / `action` callbacks on
 * `guardMiddleware`. `input` is the tool's free-text args, not the
 * opaque `toolRequest.ref`.
 */
interface GuardMiddlewareCall {
  toolName: string;
  input: unknown;
}
/**
 * Policy for `guardMiddleware()` — how to guard tools that execute
 * through `ai.generate({ use })`, including filesystem middleware
 * tools, MCP tools, and anything not wrapped with `guardTool`.
 *
 * `interrupt()` / `defineInterrupt` / `toolApproval` is HITL, not a
 * policy gate — this helper never throws `ToolInterruptError`.
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
  /** Metadata merged over the derived Genkit context. */
  metadata?: ArcjetMetadata | ((call: GuardMiddlewareCall) => ArcjetMetadata);
  /**
   * Fallback session id when the tool-hook `ctx.context` does not carry
   * one. Prefer putting the id you already chose on
   * `ai.generate({ context: { sessionId } })` *and* here when the hook
   * does not receive ALS context. Never mint a new id here.
   */
  sessionId?: string | ((call: GuardMiddlewareCall) => string | undefined);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /**
   * Reshape the denial payload the model sees for a real DENY decision.
   * Unavailable guards take the `onUnavailable` path instead.
   */
  onDeny?: (decision: DecisionDeny) => unknown;
}
/**
 * Structural `generate({ use })` middleware this helper returns.
 *
 * Matches Genkit's `normalizeMiddleware` object+`instantiate` branch
 * (not a raw function — those become *model* hooks only, which cannot
 * deny a tool). Declared here so this module never value-imports
 * `generateMiddleware`.
 */
interface GenkitGuardMiddleware {
  name: string;
  instantiate: (options?: unknown) => {
    tool: (req: unknown, ctx: unknown, next: (req: unknown, ctx: unknown) => Promise<unknown>) => Promise<unknown>;
  };
}
/**
 * A `generate({ use })` middleware whose `tool` hook is the
 * generate()-wide gate.
 *
 * Filesystem middleware tools, MCP tools, and anything not wrapped with
 * `guardTool` skip the authored handler. This is the LangGraph
 * `guardToolNode` / Claude `guardHooks` equivalent. Put it on
 * `ai.generate({ use: [guardMiddleware(...)] })`.
 *
 * The `tool` hook *can* deny: Genkit's `resolveToolRequest` treats a
 * `ToolResponsePart` returned without calling `next()` as a completed
 * tool result. This helper does that. It does **not** throw
 * `ToolInterruptError` (that sets `finishReason: "interrupted"` and is
 * HITL — see `@genkit-ai/middleware` `toolApproval`).
 *
 * Already-branded tools (`guardTool`) are skipped when they can be
 * found on the registry, so Guard is not double-called. Tools that
 * cannot be looked up are still gated (the unwrapped / MCP /
 * filesystem case).
 *
 * Correlation is read from the hook `ctx.context` (and documented
 * copies). `generate({ context })` is delivered to authored handlers
 * via ALS and is **not** copied onto the hook `ctx` today — put the
 * same id on `policy.sessionId` when you need tool-time correlation
 * through this hook. No id is minted.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardMiddleware } from "@arcjet/guard/genkit/v1";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const mcpLimit = tokenBucket({
 *   refillRate: 20,
 *   intervalSeconds: 60,
 *   maxTokens: 20,
 * });
 *
 * const response = await ai.generate({
 *   prompt: userText,
 *   tools: [lookupOrder, ...mcpTools],
 *   use: [
 *     guardMiddleware(arcjet, {
 *       action: ({ toolName }) => `${toolName}.invoked`,
 *       rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
 *       sessionId: conversationId,
 *     }),
 *   ],
 *   context: { sessionId: conversationId },
 * });
 * ```
 */
declare function guardMiddleware(client: ArcjetAgentClient, policy?: GuardMiddlewarePolicy): GenkitGuardMiddleware;
//#endregion
export { GenkitGuardMiddleware, GuardMiddlewareCall, GuardMiddlewarePolicy, guardMiddleware };