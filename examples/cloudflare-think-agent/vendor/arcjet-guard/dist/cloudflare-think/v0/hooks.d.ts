import { ActorResolver, InputsResolver } from "../../agents/actor-inputs.js";
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
export interface GuardHooksCall {
  toolName: string;
  input: unknown;
}
/**
 * Policy for `guardHooks()` — how to guard tools that execute
 * through Think's class `beforeToolCall`.
 *
 * `needsApproval` is HITL, not a policy gate — this helper never
 * installs approval hooks. After a human yes, Guard still runs on
 * the tool call.
 */
export interface GuardHooksPolicy {
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
  /**
   * Trusted actor identity, or a resolver `(call, ctx) => …` matching
   * `beforeToolCall(ctx)`. Derive it from authenticated server-side
   * context; never trust a model-produced tool input as the actor
   * identity.
   */
  actor?: ActorResolver<[GuardHooksCall, ToolCallContext]>;
  /**
   * Typed remote-policy inputs, or a resolver `(call, ctx) => …`. Build
   * each value with {@link policyInput}.
   */
  inputs?: InputsResolver<[GuardHooksCall, ToolCallContext]>;
  /** Metadata merged over the derived Cloudflare Think context. */
  metadata?: ArcjetMetadata | ((call: GuardHooksCall) => ArcjetMetadata);
  /**
   * Fallback session id when the Think tool-call context does not
   * carry one — it never does. Prefer putting the id you already
   * chose on `guardHooks({ sessionId })`. Never mint a new id here.
   */
  sessionId?: string | ((call: GuardHooksCall) => string | undefined);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /**
   * How to deliver a real DENY decision. Default substitute
   * (`{ action: "substitute", output: ArcjetDenialResult }`) so the
   * tool never runs and the model sees the payload. `"block"` returns
   * `{ action: "block", reason }` and skips the tool. No other modes.
   */
  onDeny?: "block";
}
/**
 * The Think lifecycle object this helper returns.
 *
 * This is Think's `beforeToolCall` hook (via `import type` only —
 * this module never value-imports `@cloudflare/think`). Assign
 * `hooks.beforeToolCall` on a `Think` subclass with no cast.
 */
export type CloudflareThinkGuardHooks = {
  beforeToolCall: (ctx: ToolCallContext) => Promise<ToolCallDecision | void>;
};
/**
 * A Think `beforeToolCall` hook object that is the tool-call gate.
 *
 * Assign `hooks.beforeToolCall` on a `Think` subclass. Think wraps
 * every server-side tool's `execute` so this hook runs first. Client
 * tools are out of scope — Think cannot intercept them.
 *
 * Default DENY is `{ action: "substitute", output: ArcjetDenialResult }`
 * so the tool never runs and the model sees the payload. Optional
 * `onDeny: "block"` returns `{ action: "block", reason }` (the denial
 * `message` string) and skips the tool — the model does not get
 * `ArcjetDenialResult`. Block does **not** hand the model
 * `ArcjetDenialResult` — prefer default substitute when it should.
 * `onDeny: "block"` applies to real DENY only; unavailable stays
 * substitute. This helper does **not** throw from the hook (a throw
 * from Think's `beforeToolCall` is a hook error, not a policy denial).
 *
 * On ALLOW this helper captures `outcome: "success"` when the
 * policy lets the tool run, not when `execute` finishes.
 * `beforeToolCall` cannot wrap the tool; a later tool throw does
 * not flip that capture.
 *
 * There is no `guardTool`. There is no `afterToolCall` capture
 * hook — `beforeToolCall` is the gate. Do not mix with
 * `@arcjet/guard/vercel-ai/v7`. Think is not the Vercel AI SDK.
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
 *   override beforeToolCall = hooks.beforeToolCall;
 * }
 * ```
 */
export declare function guardHooks(client: ArcjetAgentClient, policy?: GuardHooksPolicy): CloudflareThinkGuardHooks;
//#endregion