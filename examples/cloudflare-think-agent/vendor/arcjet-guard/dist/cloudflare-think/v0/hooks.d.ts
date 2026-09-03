import { ArcjetMetadata } from "../../metadata.js";
import { RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { ToolCallContext, ToolCallDecision } from "@cloudflare/think";
//#region src/cloudflare-think/v0/hooks.d.ts
/**
 * Input passed to `rules` / `metadata` / `action` callbacks on
 * `guardHooks`. `input` is the tool's free-text args, not the
 * opaque `toolCallId`.
 */
interface GuardHooksCall {
  toolName: string;
  input: unknown;
}
/**
 * Policy for `guardHooks()` — how to guard tools that execute
 * through Think's `beforeToolCall` lifecycle hook.
 *
 * Think starter `needsApproval` is HITL, not a policy gate — this
 * helper never installs it. After a human yes, Guard still runs on
 * the tool call.
 *
 * Think re-wraps `execute` on the Cloudflare Agents harness
 * (Durable Objects, workspace / MCP / client tools). Do **not** also
 * wrap the same tools with `@arcjet/guard/vercel-ai/v7`.
 */
interface GuardHooksPolicy {
  /**
   * Guard label and capture action. Defaults to `"tool.invoked"`. May be a
   * function of the tool name and args.
   */
  action?: string | ((call: GuardHooksCall) => string);
  /**
   * Rules to evaluate before a tool runs. Omitting this still performs
   * the guard call.
   */
  rules?: RuleWithInput[] | ((call: GuardHooksCall) => RuleWithInput[]);
  /** Metadata merged over the derived Cloudflare Think context. */
  metadata?: ArcjetMetadata | ((call: GuardHooksCall) => ArcjetMetadata);
  /**
   * Fallback session id when the hook context does not carry one.
   * Prefer putting the id you already chose on
   * `guardHooks({ sessionId })`. Never mint a new id here.
   */
  sessionId?: string | ((call: GuardHooksCall) => string | undefined);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /**
   * How to deliver a real DENY decision. Default substitute
   * (`{ action: "substitute", output: ArcjetDenialResult }`) so the
   * tool never runs and the model sees the payload. `"block"` returns
   * `{ action: "block", reason }` (the denial `message` string). No
   * other modes.
   */
  onDeny?: "block";
}
/**
 * The Think lifecycle object this helper returns.
 *
 * This is Think's `beforeToolCall` hook (via `import type` only — this
 * module never value-imports `@cloudflare/think`). A `Think` subclass
 * delegates to it with no cast. void / `{ action: "allow" }` runs
 * `execute`. `{ action: "block" }` / `{ action: "substitute" }` skip
 * `execute`.
 */
type CloudflareThinkGuardHooks = {
  beforeToolCall: (ctx: ToolCallContext) => Promise<ToolCallDecision | void>;
};
/**
 * Think `beforeToolCall` hooks that gate tool execution before
 * `execute` runs.
 *
 * Delegate from a `Think` subclass:
 *
 * ```ts
 * const hooks = guardHooks(arcjet, { sessionId: conversationId });
 * export class SupportAgent extends Think<Env> {
 *   beforeToolCall(ctx) {
 *     return hooks.beforeToolCall(ctx);
 *   }
 * }
 * ```
 *
 * Default DENY is `{ action: "substitute", output: ArcjetDenialResult }`
 * so the tool never runs and the model sees the payload. Optional
 * `onDeny: "block"` returns `{ action: "block", reason }` (the denial
 * `message` string). `onDeny: "block"` applies to real DENY only;
 * unavailable stays substitute. This helper does **not** throw from
 * the hook.
 *
 * On Guard error this helper fail-closes: it ALWAYS returns
 * `block` / `substitute`, never void / `{ action: "allow" }` (unless
 * `onGuardError: "allow"`). Core `protect()` / `guard()` stay
 * fail-open.
 *
 * Think starter `needsApproval` is HITL, not a policy gate. After a
 * human yes, Guard still runs. Client tools and tools with no local
 * `execute` are out of scope — Think does not fire `beforeToolCall`
 * for those.
 *
 * Already-branded tools (`arcjetProtectedTool` from a sibling
 * `guardTool`) are skipped so Guard is not double-called. This
 * namespace has no `guardTool`, and inbound `guard()` before `chat()`
 * does not stamp that brand — it is a separate call and tools are
 * still gated.
 *
 * Think re-wraps `execute` on the Cloudflare Agents harness (Durable
 * Objects, workspace / MCP / client tools). Do **not** also wrap the
 * same tools with `@arcjet/guard/vercel-ai/v7`. Mixing the two
 * wrappers on one tool is disallowed.
 *
 * On ALLOW this helper captures `outcome: "success"` when the
 * policy lets the tool run, not when `execute` finishes.
 * `beforeToolCall` cannot wrap the tool; a later tool throw does
 * not flip that capture.
 *
 * There is no `guardTool`. Skip is the hook return, not
 * throw-from-execute. There is no `guardInbound` and no
 * `guardApproval`.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardHooks } from "@arcjet/guard/cloudflare-think/v0";
 * import { Think } from "@cloudflare/think";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const mcpLimit = tokenBucket({
 *   refillRate: 20,
 *   intervalSeconds: 60,
 *   maxTokens: 20,
 * });
 *
 * const hooks = guardHooks(arcjet, {
 *   action: ({ toolName }) => `${toolName}.invoked`,
 *   rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
 *   sessionId: conversationId,
 * });
 *
 * export class SupportAgent extends Think<Env> {
 *   beforeToolCall(ctx) {
 *     return hooks.beforeToolCall(ctx);
 *   }
 * }
 * ```
 */
declare function guardHooks(client: ArcjetAgentClient, policy?: GuardHooksPolicy): CloudflareThinkGuardHooks;
//#endregion
export { CloudflareThinkGuardHooks, GuardHooksCall, GuardHooksPolicy, guardHooks };