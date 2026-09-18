import { ActorResolver, InputsResolver } from "../../agents/actor-inputs.js";
import { ArcjetMetadata } from "../../metadata.js";
import { RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { HookCallbackMatcher, HookEvent, PreToolUseHookInput, UserPromptSubmitHookInput } from "@anthropic-ai/claude-agent-sdk";
//#region src/claude-agent-sdk/v0/hooks.d.ts
/**
 * Input passed to `rules` / `metadata` / `action` callbacks on `guardHooks`
 * for PreToolUse / PostToolUse.
 */
export interface GuardHooksCall {
  toolName: string;
  input: unknown;
}
/**
 * Input passed to inbound (`UserPromptSubmit`) policy callbacks.
 */
export interface GuardHooksInbound {
  prompt: string;
}
/**
 * Inbound screen for `UserPromptSubmit`. This is the only place a turn can
 * be declined before the model sees the prompt.
 */
export interface GuardHooksInboundPolicy {
  /**
   * Guard label and capture action. Defaults to `"message.received"`.
   */
  action?: string | ((input: GuardHooksInbound) => string);
  /**
   * Rules to evaluate before the prompt is processed. Omitting this still
   * performs the guard call.
   */
  rules?: RuleWithInput[] | ((input: GuardHooksInbound) => RuleWithInput[]);
  /**
   * Trusted actor identity, or a resolver `(inbound, hookInput) => …` matching
   * Claude `UserPromptSubmit`. Derive it from `session_id` / hook input; never
   * trust the prompt as the actor identity.
   */
  actor?: ActorResolver<[GuardHooksInbound, UserPromptSubmitHookInput]>;
  /**
   * Typed remote-policy inputs, or a resolver `(inbound, hookInput) => …`.
   * Build each value with {@link policyInput}.
   */
  inputs?: InputsResolver<[GuardHooksInbound, UserPromptSubmitHookInput]>;
  /** Metadata merged over the derived Claude context. */
  metadata?: ArcjetMetadata | ((input: GuardHooksInbound) => ArcjetMetadata);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
}
/**
 * A tool `PreToolUse` must not gate, because `guardTool` already guards it.
 *
 * Either the exact name the hook reports (`"Bash"`,
 * `"mcp__support__lookup_order"`), or the authored tool plus the SDK MCP server
 * it was registered under, which resolves to `mcp__<server>__<name>`. The
 * object form exists so an authored tool can be excluded without hand-writing
 * the prefix — and so a bare name never accidentally matches another server's
 * tool of the same name.
 */
export type GuardHooksExclusion = string | {
  server: string;
  name: string;
};
/**
 * Policy for `guardHooks()` — PreToolUse (deny unwrapped / built-in tools),
 * UserPromptSubmit (inbound), and PostToolUse (capture only).
 *
 * ## Screen inbound with UserPromptSubmit
 *
 * Put prompt-injection and other inbound rules on `inbound`. A DENY returns
 * `{ decision: "block" }` so the prompt is erased. A timeout already
 * fail-closes the prompt (Claude Code v2.1.208+).
 *
 * ## canUseTool is not a policy gate
 *
 * Claude's docs say `canUseTool` is skipped by `allowedTools`, allow rules,
 * and `bypassPermissions` / `acceptEdits`. Do not put Arcjet policy there.
 * There is no `guardCanUseTool`.
 *
 * ## PreToolUse is the only deny for unwrapped tools
 *
 * Built-ins (Bash, Write, …) and MCP tools you did not pass through
 * `guardTool` are gated here with `permissionDecision: "deny"`. A timeout
 * already fail-closes (the tool does not run). PostToolUse is capture only.
 * Annotations and sandbox settings are not enforcement.
 */
export interface GuardHooksPolicy {
  /**
   * Fallback session id when hook input has no valid `session_id`. Pass the
   * same value you give `query({ options.sessionId })`. Never mint a new id.
   */
  sessionId?: string;
  /**
   * Guard label and capture action for tool hooks. Defaults to
   * `"tool.invoked"`. May be a function of the tool name and input.
   */
  action?: string | ((call: GuardHooksCall) => string);
  /**
   * Rules to evaluate before an unwrapped / built-in tool runs. Omitting
   * this still performs the guard call.
   */
  rules?: RuleWithInput[] | ((call: GuardHooksCall) => RuleWithInput[]);
  /**
   * Trusted actor identity, or a resolver `(call, hookInput) => …` matching
   * Claude `PreToolUse`. Derive it from `session_id` / hook input; never
   * trust a model-produced tool input as the actor identity.
   */
  actor?: ActorResolver<[GuardHooksCall, PreToolUseHookInput]>;
  /**
   * Typed remote-policy inputs, or a resolver `(call, hookInput) => …`. Build
   * each value with {@link policyInput}.
   */
  inputs?: InputsResolver<[GuardHooksCall, PreToolUseHookInput]>;
  /** Metadata merged over the derived Claude context for tool hooks. */
  metadata?: ArcjetMetadata | ((call: GuardHooksCall) => ArcjetMetadata);
  /** How to respond when a tool-gate evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /**
   * Tools that `PreToolUse` must not gate, because they are already wrapped
   * with `guardTool`. Without this the wrapped tool is guarded twice for one
   * invocation — two round trips, two quota units — since `PreToolUse` fires
   * for every tool and the hook input carries only a name, never the Arcjet
   * brand `guardTool` applies.
   *
   * Entries match the reported tool name **exactly**. An authored tool reaches
   * hooks as `mcp__<server>__<tool>`, so name its server with
   * `{ server, name }` and the qualified name is built for you. A bare string
   * is matched as-is, which is what you want for a built-in such as `"Bash"` —
   * it does **not** match `mcp__support__Bash`.
   *
   * `PostToolUse` capture is unaffected: excluding a tool stops the gate, not
   * the audit trail.
   *
   * @example
   * ```ts
   * guardHooks(arcjet, {
   *   exclude: [
   *     { server: "support", name: "lookup_order" },
   *     { server: "support", name: "issue_refund" },
   *   ],
   * })
   * ```
   */
  exclude?: readonly GuardHooksExclusion[];
  /** Inbound screen on `UserPromptSubmit`. Defaults to action `"message.received"`. */
  inbound?: GuardHooksInboundPolicy;
}
/**
 * Whether `PreToolUse` should skip this tool because `guardTool` already guards
 * it.
 *
 * Matching is **exact** against the name the hook reports. It deliberately does
 * not treat a bare authored name as matching every MCP-qualified tool ending in
 * it: two servers can expose the same tool name, and only one of them may be
 * wrapped, so a loose match would silently drop the gate on an unprotected
 * tool. Name the server with `{ server, name }` when excluding an authored tool.
 */
export declare function isExcludedTool(toolName: string, exclude: readonly GuardHooksExclusion[] | undefined): boolean;
/**
 * Claude Agent SDK hooks that screen inbound prompts and gate unwrapped tools.
 *
 * Registers three events:
 * - `UserPromptSubmit` — inbound screen. DENY is `{ decision: "block" }`.
 * - `PreToolUse` — the only deny for built-ins and unwrapped MCP. DENY is
 *   `permissionDecision: "deny"`.
 * - `PostToolUse` — capture only; never blocks.
 *
 * Use this for tools you did not pass through `guardTool`. Do not also wrap
 * the same authored tool with `@arcjet/guard/vercel-ai/v7`. Do not put
 * policy on `canUseTool`.
 *
 * @example
 * ```ts
 * import { launchArcjet, detectPromptInjection, tokenBucket } from "@arcjet/guard";
 * import { guardHooks } from "@arcjet/guard/claude-agent-sdk/v0";
 * import { query } from "@anthropic-ai/claude-agent-sdk";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const mcpLimit = tokenBucket({
 *   refillRate: 20,
 *   intervalSeconds: 60,
 *   maxTokens: 20,
 * });
 *
 * const sessionId = conversationId;
 *
 * for await (const message of query({
 *   prompt: userText,
 *   options: {
 *     sessionId,
 *     hooks: guardHooks(arcjet, {
 *       sessionId,
 *       action: ({ toolName }) => `${toolName}.invoked`,
 *       rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
 *       inbound: {
 *         action: "message.received",
 *         rules: ({ prompt }) => [detectPromptInjection()(prompt)],
 *       },
 *     }),
 *   },
 * })) {
 *   void message;
 * }
 * ```
 */
export declare function guardHooks(client: ArcjetAgentClient, policy?: GuardHooksPolicy): Partial<Record<HookEvent, HookCallbackMatcher[]>>;
//#endregion