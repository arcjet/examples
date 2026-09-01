import { ArcjetMetadata } from "../../metadata.js";
import { RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { ChatMiddleware } from "@tanstack/ai";
//#region src/tanstack-ai/v0/guard-middleware.d.ts
/**
 * Input passed to `rules` / `metadata` / `action` callbacks on
 * `guardMiddleware`. `input` is the tool's free-text args, not the
 * opaque `toolCallId`.
 */
interface GuardMiddlewareCall {
  toolName: string;
  input: unknown;
}
/**
 * Policy for `guardMiddleware()` — how to guard tools that execute
 * through `chat({ middleware })` via `ChatMiddleware.onBeforeToolCall`.
 *
 * `needsApproval` / `defineInterrupt` / `onInterruptBoundary` is HITL,
 * not a policy gate — this helper never installs those hooks. After a
 * human yes, Guard still runs on the tool call.
 */
interface GuardMiddlewarePolicy {
  /**
   * Guard label and capture action. Defaults to `"tool.invoked"`. May be a
   * function of the tool name and args.
   */
  action?: string | ((call: GuardMiddlewareCall) => string);
  /**
   * Rules to evaluate before a tool runs. Omitting this still performs
   * the guard call.
   */
  rules?: RuleWithInput[] | ((call: GuardMiddlewareCall) => RuleWithInput[]);
  /** Metadata merged over the derived TanStack AI context. */
  metadata?: ArcjetMetadata | ((call: GuardMiddlewareCall) => ArcjetMetadata);
  /**
   * Fallback session id when `chat({ context })` does not carry one.
   * Prefer putting the id you already chose on
   * `chat({ context: { sessionId } })`. Never mint a new id here.
   */
  sessionId?: string | ((call: GuardMiddlewareCall) => string | undefined);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /**
   * How to deliver a real DENY decision. Default skip
   * (`{ type: "skip", result: ArcjetDenialResult }`) so the tool never
   * runs and the model sees the payload. `"abort"` returns
   * `{ type: "abort", reason }` and stops the chat run. No other modes.
   */
  onDeny?: "abort";
}
/**
 * The `chat({ middleware })` object this helper returns.
 *
 * This is TanStack AI's `ChatMiddleware` (via `import type` only — this
 * module never value-imports `@tanstack/ai`). `chat({ middleware })`
 * accepts it with no cast.
 */
type TanStackAiGuardMiddleware = ChatMiddleware & {
  name: string;
  onBeforeToolCall: NonNullable<ChatMiddleware["onBeforeToolCall"]>;
};
/**
 * A `chat({ middleware })` middleware whose `onBeforeToolCall` is the
 * tool-call gate.
 *
 * Put Arcjet **first** in the middleware array. `onBeforeToolCall` is
 * first-win: the first middleware that returns a non-void decision
 * wins, and the rest are skipped. If `toolCacheMiddleware` (or
 * anything else) skips first, Guard never runs.
 *
 * Default DENY is `{ type: "skip", result: ArcjetDenialResult }` so
 * the tool never runs and the model sees the payload. Optional
 * `onDeny: "abort"` returns `{ type: "abort", reason }` (the denial
 * `message` string) and stops the chat run. Abort does **not** hand
 * the model `ArcjetDenialResult` — prefer default skip when it
 * should. `onDeny: "abort"` applies to real DENY only; unavailable
 * stays skip. This helper does **not** throw from the hook (TanStack
 * swallows a throw from `execute` into `{ error }`, and a throw from
 * this hook would abort the run as an error rather than a policy
 * denial).
 *
 * Already-branded tools (`arcjetProtectedTool` from a sibling
 * `guardTool`) are skipped so Guard is not double-called. This
 * namespace has no `guardTool`, and inbound `guard()` before
 * `chat()` does not stamp that brand — it is a separate call and
 * tools are still gated. Tools that are not branded — including
 * when `hookCtx.tool` is undefined — are still gated.
 *
 * On ALLOW this helper captures `outcome: "success"` when the
 * policy lets the tool run, not when `execute` finishes.
 * `onBeforeToolCall` cannot wrap the tool; a later tool throw does
 * not flip that capture.
 *
 * There is no `guardTool`. Throwing from `execute` is swallowed into
 * `{ error }` and is not a usable deny envelope.
 *
 * Client tools and provider-native tools with no local `execute` are
 * out of scope. Do not double-wrap with `@arcjet/guard/vercel-ai/v7`.
 * TanStack AI is not the Vercel AI SDK.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardMiddleware } from "@arcjet/guard/tanstack-ai/v0";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const mcpLimit = tokenBucket({
 *   refillRate: 20,
 *   intervalSeconds: 60,
 *   maxTokens: 20,
 * });
 *
 * const stream = chat({
 *   adapter,
 *   messages,
 *   tools: [lookupOrder, ...mcpTools],
 *   context: { sessionId: conversationId },
 *   middleware: [
 *     guardMiddleware(arcjet, {
 *       action: ({ toolName }) => `${toolName}.invoked`,
 *       rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
 *       sessionId: conversationId,
 *     }),
 *     toolCacheMiddleware(),
 *   ],
 * });
 * ```
 */
declare function guardMiddleware(client: ArcjetAgentClient, policy?: GuardMiddlewarePolicy): TanStackAiGuardMiddleware;
//#endregion
export { GuardMiddlewareCall, GuardMiddlewarePolicy, TanStackAiGuardMiddleware, guardMiddleware };