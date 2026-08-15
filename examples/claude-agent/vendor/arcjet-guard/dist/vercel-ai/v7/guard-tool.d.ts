import { ArcjetMetadata } from "../../metadata.js";
import { PolicyInputMap } from "../../policy-input.js";
import { DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { ArcjetAgentContext } from "../../agents/context.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { InferToolInput, InferToolOutput, Tool } from "ai";
//#region src/vercel-ai/v7/guard-tool.d.ts
/**
 * Structured tool result returned to the model when a call is denied.
 *
 * The model receives this object as the tool's return value (not an error) when
 * a guard check denies the call. The model can inspect `reason`, `message`, and
 * `retryable` to decide whether to retry, explain the denial to the user, or try
 * a different approach.
 */
interface ArcjetDenialResult {
  arcjetDenied: true;
  /** Denial reason, e.g. `"RATE_LIMIT"` or `"PROMPT_INJECTION"`. */
  reason: string;
  /** Human/model-readable explanation of the denial. */
  message: string;
  /** Whether retrying later can succeed (true for rate limits). */
  retryable: boolean;
  /** Seconds until a rate-limited call may be retried. */
  retryAfterSeconds?: number;
}
/**
 * Policy for `guardTool()` — how to guard a tool's execution.
 *
 * Specifies the guard action name, optional rules to evaluate, metadata
 * context, and optional denial handler. Rules can be static or computed
 * from the tool's input.
 *
 * **Constraints:**
 * - The tool must not declare its own `contextSchema` (that slot carries the `ArcjetAgentContext`).
 * - The `action` is required and is the guard label and capture action.
 * - `rules` may be omitted to submit none. The guard call still happens.
 * - Metadata is merged on top of the context's and can depend on input.
 */
interface GuardToolPolicy<T extends Tool> {
  /** Guard label and capture action: `"resource.verb"`, past tense. */
  action: string;
  /**
   * Rules to evaluate, static or computed from the tool's input. Omitting
   * this, or returning `[]`, submits no rules — it does not skip the guard
   * call, which still costs a round trip and returns a decision.
   */
  rules?: RuleWithInput[] | ((input: InferToolInput<T>) => RuleWithInput[]);
  /**
   * Trusted actor identity, or a resolver over parsed input and trusted
   * context. Derive it from authenticated server-side context; never trust a
   * model-produced tool input as the actor identity — a policy can be
   * conditioned on the actor, so a model-controlled value could escape scope.
   *
   * @example
   * ```ts
   * // Static, from trusted context set up before the run.
   * actor: trustedClient.id,
   * // Or resolved from the agent context (not the model's tool input).
   * actor: (input, ctx) => ctx?.userId ?? "anonymous",
   * ```
   */
  actor?: string | ((input: InferToolInput<T>, context: ArcjetAgentContext | undefined) => string | Promise<string>);
  /**
   * Typed remote-policy inputs, or a resolver over the parsed tool input. Build
   * each value with {@link policyInput}.
   *
   * @example
   * ```ts
   * inputs: ({ recipient, body }) => ({
   *   recipient: policyInput.server.string(recipient),
   *   body: policyInput.local.string(body),
   * }),
   * ```
   */
  inputs?: PolicyInputMap | ((input: InferToolInput<T>, context: ArcjetAgentContext | undefined) => PolicyInputMap | Promise<PolicyInputMap>);
  /** Metadata merged over the context's (object, or per-call function of the tool input). */
  metadata?: ArcjetMetadata | ((input: InferToolInput<T>) => ArcjetMetadata);
  /** Explicit correlation ID; overrides the context's when set. */
  correlationId?: string;
  /**
   * How to respond when guard evaluation is unavailable (the default is
   * `"deny"`). With `"allow"`, the wrapped tool executes on any guard
   * error or failed-open decision, and a warning is emitted. With `"deny"`,
   * the tool does not execute and the model receives an `ArcjetDenialResult`.
   */
  onGuardError?: OnGuardError;
  /**
   * Reshape the denial payload the model sees for a real DENY decision.
   * Unavailable guards take the `onUnavailable` path instead and return the
   * fixed `{ reason: "ERROR", retryable: true, retryAfterSeconds: 5 }` result;
   * this callback does not fire for outages.
   */
  onDeny?: (decision: DecisionDeny) => unknown;
}
/**
 * Wraps an AI SDK tool with guard-gated execution and event capture.
 *
 * Always runs `guard()` before the tool, submitting `policy.rules` or none; on
 * DENY the tool never executes and the model receives an `ArcjetDenialResult`
 * (or the result of `policy.onDeny`). On ALLOW — which is what submitting no
 * rules returns — the tool runs and the outcome is captured.
 *
 * Guard API errors behavior depends on `policy.onGuardError` (defaults to `"deny"`):
 * - `"deny"` (default): Tool does not execute; the model receives an `ArcjetDenialResult`
 *   with `reason: "ERROR"`, `retryable: true`, and a fixed `retryAfterSeconds: 5` hint.
 * - `"allow"`: Tool still runs, with a warning gated on `ARCJET_LOG_LEVEL`.
 *
 * The wrapper injects a `contextSchema` of `ArcjetAgentContext | undefined` to
 * carry correlation and metadata, so a tool that declares its own
 * `contextSchema` cannot be wrapped.
 *
 * @param client - Guard client from `launchArcjet()`
 * @param tool - The tool to wrap; must have an `execute` function and no `contextSchema`
 * @param policy - Execution policy: `action` (required), `rules`, `metadata`, `correlationId` override, `onGuardError`, `onDeny` hook
 * @returns A tool with protected `execute`, injected `contextSchema`, and context type `ArcjetAgentContext | undefined`
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { tool, jsonSchema, generateText } from "ai";
 * import { guardTool, createAgentContext, aiToolsContext } from "@arcjet/guard/vercel-ai/v7";
 *
 * const arcjetClient = launchArcjet({ key: process.env.ARCJET_KEY! });
 *
 * const sendEmailTool = tool({
 *   description: "Send an email",
 *   inputSchema: jsonSchema<{ to: string; subject: string }>({
 *     type: "object",
 *     properties: { to: { type: "string" }, subject: { type: "string" } },
 *     required: ["to", "subject"],
 *   }),
 *   execute: async (input) => {
 *     // Real email service call
 *     return { success: true, messageId: "msg-123" };
 *   },
 * });
 *
 * const emailLimit = tokenBucket({
 *   refillRate: 5,
 *   intervalSeconds: 60,
 *   maxTokens: 5,
 * });
 *
 * const protectedEmail = guardTool(arcjetClient, sendEmailTool, {
 *   action: "email.sent",
 *   onGuardError: "deny", // default — blocks the call if Arcjet is unreachable
 *   rules: () => [emailLimit({ key: userId, requested: 1 })],
 * });
 *
 * const ctx = createAgentContext({ correlationId: "req-123" });
 * const protectedTools = { sendEmail: protectedEmail };
 * const result = await generateText({
 *   model: languageModel, // Use a real language model, e.g., from @ai-sdk/openai
 *   tools: protectedTools,
 *   toolsContext: aiToolsContext(ctx, protectedTools),
 *   prompt: "Send a confirmation email",
 * });
 * ```
 */
declare function guardTool<T extends Tool>(client: ArcjetAgentClient, tool: T, policy: GuardToolPolicy<T>): Tool<InferToolInput<T>, InferToolOutput<T>, ArcjetAgentContext | undefined>;
//#endregion
export { ArcjetDenialResult, GuardToolPolicy, guardTool };