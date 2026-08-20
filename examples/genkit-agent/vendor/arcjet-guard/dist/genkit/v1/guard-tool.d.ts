import { ArcjetMetadata } from "../../metadata.js";
import { DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
//#region src/genkit/v1/guard-tool.d.ts
/**
 * Structural `defineTool` / `tool()` action. Declared here so `guardTool`
 * does not value-import `genkit`.
 *
 * After `ai.defineTool(config, handler)` the authored handler is closed
 * over inside the returned `ToolAction`. `generate()` calls that action
 * as a function (`tool(input, options)`), which delegates to `.run`.
 *
 * The call signature is `(...args: never[]) => unknown` so a real
 * `ToolAction` — whose parameters are a concrete input and
 * `ToolRunOptions` — stays assignable under `strictFunctionTypes`.
 * Written as `(input?: unknown, options?: unknown)` those parameters
 * are contravariant and every real tool is rejected at the call site.
 */
type GenkitTool = ((...args: never[]) => unknown) & {
  __action?: {
    name?: string;
    key?: string;
    metadata?: Record<string, unknown>;
    actionType?: string;
  };
  run?(...args: never[]): unknown;
  stream?(...args: never[]): unknown;
  respond?(interrupt: unknown, outputData: unknown, options?: unknown): unknown;
  restart?(interrupt: unknown, resumedMetadata?: unknown, options?: unknown): unknown;
};
/**
 * Input type of a Genkit `defineTool` / `tool()` action. Used so
 * `guardTool` can keep the concrete tool type while still typing
 * `policy.rules` against the tool args (not opaque call refs).
 */
type GenkitToolInput<TTool> = TTool extends {
  (input?: infer TInput, options?: unknown): unknown;
} ? TInput : unknown;
/**
 * Policy for `guardTool()` — how to guard an authored
 * `ai.defineTool(config, handler)`.
 *
 * Specifies the guard action name, optional rules to evaluate, metadata
 * context, and optional denial handler. Rules can be static or computed
 * from the tool's free-text args. Do not scan opaque call refs.
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
   * Fallback session id when the tool options / generate context do not
   * carry one. Prefer putting the id you already chose on
   * `ai.generate({ context: { sessionId } })`. Never mint a new id here.
   * Never pass a Genkit `Session.sessionId` that the Session constructed
   * without an id — that class mints a UUID.
   */
  sessionId?: string | ((input: TInput) => string | undefined);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /**
   * Reshape the denial payload the model sees for a real DENY decision.
   * The value is returned from the tool action as-is, which is what
   * `generate()` puts on `toolResponse.output`. Unavailable guards take
   * the `onUnavailable` path instead and return the fixed
   * `{ reason: "ERROR", retryable: true, retryAfterSeconds: 5 }` result;
   * this callback does not fire for outages.
   *
   * **Warning:** A tool created with `outputSchema` validates the
   * authored handler's return *inside* the `ToolAction` this wrapper
   * replaces. A denial is not schema-checked. Prefer omitting
   * `outputSchema` on guarded tools, or verify the schema accepts
   * `ArcjetDenialResult` / your `onDeny` shape. Returning a
   * schema-mismatched value from the *inner* handler would throw and
   * fail `generate()` — wrapping the action is what keeps a denial a
   * completed tool result.
   */
  onDeny?: (decision: DecisionDeny) => unknown;
}
/**
 * Wraps a `defineTool` / `tool()` `ToolAction` so the closed-over
 * handler never runs on DENY.
 *
 * After `ai.defineTool(config, handler)` the runner calls the returned
 * action as a function. This helper replaces that callable (and `.run`,
 * so a direct `tool.run()` is gated the same way) and always runs
 * `guard()` before the original action. On DENY the original action —
 * and therefore the authored handler and `outputSchema` validation —
 * never runs. The model receives an `ArcjetDenialResult` (or the result
 * of `policy.onDeny`) as a completed `toolResponse.output`. This helper
 * does not throw on DENY and does not call `interrupt()` /
 * `ToolInterruptError` (those are HITL).
 *
 * `ai.generate({ tools })` converts the array to name/schema
 * definitions and looks the live action up on the registry. This helper
 * therefore overwrites the original registry entry so generate() cannot
 * run the unguarded `defineTool` action. Dynamic tools are registered
 * from the `tools` array at generate() time and do not need that.
 *
 * Guard API errors depend on `policy.onGuardError` (defaults to `"deny"`):
 * - `"deny"` (default): handler does not run; the model receives an
 *   `ArcjetDenialResult` with `reason: "ERROR"`.
 * - `"allow"`: handler still runs, with a warning gated on
 *   `ARCJET_LOG_LEVEL`.
 *
 * Correlation is read from the tool `options.context` (and documented
 * copies on the envelope). `generate({ context })` is delivered to the
 * authored handler via Genkit's ALS; the wrapper sees it when the
 * caller passed `options.context` explicitly, or via `policy.sessionId`.
 * No id is minted. `interrupt` / `resumed` / `traceId` are never read.
 *
 * Filesystem middleware tools, MCP tools, and anything not wrapped with
 * `guardTool` skip this path — use `guardMiddleware` for those. Do not
 * also wrap the same tool with `@arcjet/guard/vercel-ai/v7`. The shared
 * `arcjetProtectedTool` brand throws on a second `guardTool` wrap.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardTool } from "@arcjet/guard/genkit/v1";
 * import { genkit, z } from "genkit";
 *
 * const ai = genkit({ ... });
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const lookupLimit = tokenBucket({
 *   refillRate: 10,
 *   intervalSeconds: 60,
 *   maxTokens: 10,
 * });
 *
 * export const lookupOrder = guardTool(
 *   arcjet,
 *   ai.defineTool(
 *     {
 *       name: "lookup_order",
 *       description: "Look up an order by number",
 *       inputSchema: z.object({ orderNumber: z.string() }),
 *     },
 *     async ({ orderNumber }) => ({ orderNumber, status: "shipped" }),
 *   ),
 *   {
 *     action: "order.looked-up",
 *     rules: (input) => [lookupLimit({ key: input.orderNumber, requested: 1 })],
 *   },
 * );
 * ```
 */
declare function guardTool<TInput = unknown, TTool extends GenkitTool = GenkitTool>(client: ArcjetAgentClient, tool: TTool, policy: GuardToolPolicy<TInput>): TTool;
//#endregion
export { GenkitTool, GenkitToolInput, GuardToolPolicy, guardTool };