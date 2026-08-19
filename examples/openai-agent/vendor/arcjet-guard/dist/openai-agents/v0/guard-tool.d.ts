import { ArcjetMetadata } from "../../metadata.js";
import { DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
//#region src/openai-agents/v0/guard-tool.d.ts
/**
 * Structural `tool()` / `FunctionTool`. Declared here so `guardTool` does
 * not value-import `@openai/agents`.
 *
 * After `tool({ execute })` the authored `execute` is closed over inside
 * `invoke`. The runner (`toolExecution.ts`) calls `invoke(runContext,
 * argumentsJson, details)` — there is no `execute` on the returned object
 * and no ToolNode. `invoke` is declared with method syntax so a real
 * `FunctionTool` (whose `invoke` is a property typed against `RunContext`)
 * is assignable under `strictFunctionTypes`.
 */
interface OpenAIAgentsTool {
  name: string;
  description?: string;
  type?: string;
  invoke(runContext: unknown, input: string, details?: unknown): unknown;
}
/**
 * Policy for `guardTool()` — how to guard an authored `tool({ execute })`.
 *
 * Specifies the guard action name, optional rules to evaluate, metadata
 * context, and optional denial handler. Rules can be static or computed
 * from the tool's parsed free-text args. Do not scan opaque call ids.
 */
interface GuardToolPolicy<TInput> {
  /** Guard label and capture action: `"resource.verb"`, past tense. */
  action: string;
  /**
   * Rules to evaluate, static or computed from the tool's parsed args.
   * Omitting this, or returning `[]`, submits no rules — it does not skip
   * the guard call, which still costs a round trip and returns a decision.
   */
  rules?: RuleWithInput[] | ((input: TInput) => RuleWithInput[]);
  /** Metadata merged over the context's (object, or per-call function of the tool input). */
  metadata?: ArcjetMetadata | ((input: TInput) => ArcjetMetadata);
  /**
   * Fallback session id when `runContext.context` does not carry one.
   * Prefer putting the id you already chose on `run(..., { context })`.
   * Never mint a new id here. Never pass `session.getSessionId()` as a
   * factory that would run against a MemorySession constructed without
   * `sessionId` — that class mints a UUID.
   */
  sessionId?: string | ((input: TInput) => string | undefined);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /**
   * Reshape the denial payload the model sees for a real DENY decision.
   * The value is returned from `invoke` as-is, which is what `execute`
   * already does; the runner stringifies it onto a `function_call_result`.
   * Unavailable guards take the `onUnavailable` path instead and return
   * the fixed `{ reason: "ERROR", retryable: true, retryAfterSeconds: 5 }`
   * result; this callback does not fire for outages.
   *
   * **Warning:** A tool created with `outputSchema` validates `execute`'s
   * return. That validation lives inside the `invoke` this wrapper replaces,
   * so a denial is not schema-checked. Prefer omitting `outputSchema` on
   * guarded tools, or verify the schema accepts `ArcjetDenialResult` / your
   * `onDeny` shape.
   */
  onDeny?: (decision: DecisionDeny) => unknown;
}
/**
 * Wraps a `tool()` / `FunctionTool` so the closed-over `execute` never
 * runs on DENY.
 *
 * After `tool({ execute })` the runner calls `invoke`, not `execute`.
 * This helper replaces `invoke` (via `Object.defineProperty`, so a
 * non-writable descriptor still gets the wrap) and always runs `guard()`
 * before the original `invoke`. On DENY the original `invoke` — and
 * therefore `execute` — never runs. The model receives an
 * `ArcjetDenialResult` (or the result of `policy.onDeny`). This helper
 * does not throw on DENY: a throw would hit the SDK `errorFunction`
 * (generic string, or `ToolCallError` when `outputSchema` /
 * `errorFunction: null`).
 *
 * Guard API errors depend on `policy.onGuardError` (defaults to `"deny"`):
 * - `"deny"` (default): `execute` does not run; the model receives an
 *   `ArcjetDenialResult` with `reason: "ERROR"`.
 * - `"allow"`: `execute` still runs, with a warning gated on
 *   `ARCJET_LOG_LEVEL`.
 *
 * Correlation is read from `runContext.context` (and documented copies
 * on the envelope). No id is minted. `session.getSessionId()` is never
 * called.
 *
 * The runner treats whatever this returns as the tool's output, so two
 * per-tool options see a denial as they would any other result: a
 * `timeoutMs` race covers the guard round trip as well as `execute`, and
 * `outputGuardrails` / `customDataExtractor` receive the denial object.
 * Keep `timeoutMs` wide enough for a guard call, and do not assume your own
 * output shape in those callbacks.
 *
 * Hosted tools, MCP (`mcpToFunctionTool`), handoffs, `agent.asTool()`,
 * and computer / shell / apply_patch are not on this path. Do not also
 * wrap the same tool with `@arcjet/guard/vercel-ai/v7`. The shared
 * `arcjetProtectedTool` brand throws on a second `guardTool` wrap.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardTool } from "@arcjet/guard/openai-agents/v0";
 * import { tool } from "@openai/agents";
 * import { z } from "zod";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const lookupLimit = tokenBucket({
 *   refillRate: 10,
 *   intervalSeconds: 60,
 *   maxTokens: 10,
 * });
 *
 * export const lookupOrder = guardTool(
 *   arcjet,
 *   tool({
 *     name: "lookup_order",
 *     description: "Look up an order by number",
 *     parameters: z.object({ orderNumber: z.string() }),
 *     execute: async ({ orderNumber }) => ({ orderNumber, status: "shipped" }),
 *   }),
 *   {
 *     action: "order.looked-up",
 *     rules: (input: { orderNumber: string }) => [
 *       lookupLimit({ key: input.orderNumber, requested: 1 }),
 *     ],
 *   },
 * );
 * ```
 */
declare function guardTool<TInput = unknown, TTool extends OpenAIAgentsTool = OpenAIAgentsTool>(client: ArcjetAgentClient, tool: TTool, policy: GuardToolPolicy<TInput>): TTool;
//#endregion
export { GuardToolPolicy, OpenAIAgentsTool, guardTool };