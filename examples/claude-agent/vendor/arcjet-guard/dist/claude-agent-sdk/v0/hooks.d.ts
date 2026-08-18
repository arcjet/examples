import { ArcjetMetadata } from "../../metadata.js";
import { RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { HookCallbackMatcher, HookEvent } from "@anthropic-ai/claude-agent-sdk";
//#region src/claude-agent-sdk/v0/hooks.d.ts
/**
 * Input passed to `rules` / `metadata` / `action` callbacks on `guardHooks`
 * for PreToolUse / PostToolUse.
 */
interface GuardHooksCall {
  toolName: string;
  input: unknown;
}
/**
 * Input passed to inbound (`UserPromptSubmit`) policy callbacks.
 */
interface GuardHooksInbound {
  prompt: string;
}
/**
 * Inbound screen for `UserPromptSubmit`. This is the only place a turn can
 * be declined before the model sees the prompt.
 */
interface GuardHooksInboundPolicy {
  /**
   * Guard label and capture action. Defaults to `"message.received"`.
   */
  action?: string | ((input: GuardHooksInbound) => string);
  /**
   * Rules to evaluate before the prompt is processed. Omitting this still
   * performs the guard call.
   */
  rules?: RuleWithInput[] | ((input: GuardHooksInbound) => RuleWithInput[]);
  /** Metadata merged over the derived Claude context. */
  metadata?: ArcjetMetadata | ((input: GuardHooksInbound) => ArcjetMetadata);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
}
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
interface GuardHooksPolicy {
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
  /** Metadata merged over the derived Claude context for tool hooks. */
  metadata?: ArcjetMetadata | ((call: GuardHooksCall) => ArcjetMetadata);
  /** How to respond when a tool-gate evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /** Inbound screen on `UserPromptSubmit`. Defaults to action `"message.received"`. */
  inbound?: GuardHooksInboundPolicy;
}
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
declare function guardHooks(client: ArcjetAgentClient, policy?: GuardHooksPolicy): Partial<Record<HookEvent, HookCallbackMatcher[]>>;
//#endregion
export { GuardHooksCall, GuardHooksInbound, GuardHooksInboundPolicy, GuardHooksPolicy, guardHooks };