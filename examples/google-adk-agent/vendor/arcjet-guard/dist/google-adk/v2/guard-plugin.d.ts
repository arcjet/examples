import { ArcjetMetadata } from "../../metadata.js";
import { RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { BasePlugin } from "@google/adk";
//#region src/google-adk/v2/guard-plugin.d.ts
/**
 * Input passed to `rules` / `metadata` / `action` callbacks on
 * `guardPlugin`. `input` is the tool's free-text args, not the
 * opaque `functionCallId`.
 */
interface GuardPluginCall {
  toolName: string;
  input: unknown;
}
/**
 * Policy for `guardPlugin()` — how to guard tools that execute
 * through a Runner `BasePlugin.beforeToolCallback`.
 *
 * `requireConfirmation` / `toolContext.requestConfirmation` /
 * `SecurityPlugin` CONFIRM is HITL, not a policy gate — this helper
 * never installs those hooks and does not use `SecurityPlugin`. After
 * a human yes, Guard still runs on the tool call.
 */
interface GuardPluginPolicy {
  /**
   * Guard label and capture action. Defaults to `"tool.invoked"`. May be a
   * function of the tool name and args.
   */
  action?: string | ((call: GuardPluginCall) => string);
  /**
   * Rules to evaluate before a tool runs. Omitting this still performs
   * the guard call.
   */
  rules?: RuleWithInput[] | ((call: GuardPluginCall) => RuleWithInput[]);
  /** Metadata merged over the derived Google ADK context. */
  metadata?: ArcjetMetadata | ((call: GuardPluginCall) => ArcjetMetadata);
  /**
   * Fallback session id when the tool context does not carry a
   * caller-owned one. Prefer putting the id you already chose on
   * helper options or session `state`. Never mint a new id here.
   */
  sessionId?: string | ((call: GuardPluginCall) => string | undefined);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
}
/**
 * The Runner plugin this helper returns.
 *
 * This is ADK's `BasePlugin` (via `import type` only — this module
 * never value-imports `@google/adk`). `new Runner({ plugins })`
 * accepts it with no cast. PluginManager does not check
 * `instanceof`; it calls methods by name. Returning a dictionary
 * from `beforeToolCallback` stops `runAsync` and short-circuits
 * remaining plugins.
 */
type GoogleAdkGuardPlugin = BasePlugin;
/**
 * A Runner `BasePlugin` whose `beforeToolCallback` is the tool-call
 * gate.
 *
 * Put Arcjet **first** in `new Runner({ plugins })`. PluginManager
 * is first-win: the first plugin that returns a non-`undefined`
 * value short-circuits remaining plugins and agent callbacks. If
 * another plugin (including `SecurityPlugin`) returns first, Guard
 * never runs.
 *
 * DENY is a dictionary (`ArcjetDenialResult`). ADK treats a returned
 * dict as skip: `runAsync` does not run and the model sees the
 * payload. `undefined` lets the tool execute. This helper does
 * **not** throw from the callback — PluginManager wraps a throw as a
 * plugin error, which is a different path than skip.
 *
 * On Guard error this helper fail-closes: it ALWAYS returns a deny
 * dict, never `undefined` (unless `onGuardError: "allow"`). Core
 * `protect()` / `guard()` stay fail-open.
 *
 * Do not use ADK `SecurityPlugin` as the Arcjet policy gate.
 * `requireConfirmation` / `requestConfirmation` is HITL. After a
 * human yes, Guard still runs.
 *
 * Already-branded tools (`arcjetProtectedTool` from a sibling
 * `guardTool`) are skipped so Guard is not double-called. This
 * namespace has no `guardTool`, and inbound `guard()` before
 * `Runner.runAsync` does not stamp that brand — it is a separate
 * call and tools are still gated. The plugin does not implement an
 * inbound / before-model prompt gate (`onUserMessageCallback` and
 * `beforeModelCallback` are no-ops) so a preceding `guard()` does
 * not double-call. Tools that are not branded — including when
 * `params.tool` is unbranded — are still gated.
 *
 * On ALLOW this helper captures `outcome: "success"` when the
 * policy lets the tool run, not when `runAsync` finishes.
 * `beforeToolCallback` cannot wrap the tool; a later tool throw
 * does not flip that capture.
 *
 * There is no `guardTool`. Skip is the plugin return, not
 * throw-from-execute. There is no `guardInbound` and no
 * `guardApproval`: `onUserMessageCallback` replaces the user
 * message, `beforeRunCallback` / `beforeModelCallback` return
 * `Content` / `LlmResponse` rather than a deny dict, and
 * confirmation is HITL. Tool gate is enough for v2.
 *
 * Do not double-wrap with `@arcjet/guard/vercel-ai/v7`. This is
 * Google ADK JS (`@google/adk` 2.x), not `@google/genai` and not
 * Python google-adk.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardPlugin } from "@arcjet/guard/google-adk/v2";
 * import { Runner } from "@google/adk";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const mcpLimit = tokenBucket({
 *   refillRate: 20,
 *   intervalSeconds: 60,
 *   maxTokens: 20,
 * });
 *
 * const runner = new Runner({
 *   appName: "my_app",
 *   agent,
 *   sessionService,
 *   plugins: [
 *     guardPlugin(arcjet, {
 *       action: ({ toolName }) => `${toolName}.invoked`,
 *       rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
 *       sessionId: conversationId,
 *     }),
 *   ],
 * });
 * ```
 */
declare function guardPlugin(client: ArcjetAgentClient, policy?: GuardPluginPolicy): GoogleAdkGuardPlugin;
//#endregion
export { GoogleAdkGuardPlugin, GuardPluginCall, GuardPluginPolicy, guardPlugin };