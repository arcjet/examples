import { ActorResolver, InputsResolver } from "../../agents/actor-inputs.js";
import { ArcjetMetadata } from "../../metadata.js";
import { DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { ApprovalConfiguration, ApprovalContext, ApprovalPolicy, ApprovalResponseContext, ApprovalStatus } from "./approval-types.js";
//#region src/vercel-eve/v0/guard-approval.d.ts
/**
 * Policy for `guardApproval()` — how to gate a tool call or connection invocation via Eve.
 *
 * Specifies the action label, optional rules, metadata context, and optional handlers
 * for allowing or denying. Rules can be static or computed from the approval context.
 *
 * Set `response` to also authorize who may approve a parked HITL request. Omitting
 * it keeps the returned value as Eve's function form (`ApprovalPolicy`).
 */
export interface GuardApprovalPolicy<TInput = Record<string, unknown>> {
  /** Guard label and capture action: `"resource.verb"`, past tense. */
  action: string;
  /** Rules to evaluate, static or computed from the approval context. */
  rules?: RuleWithInput[] | ((ctx: ApprovalContext<TInput>) => RuleWithInput[]);
  /**
   * Trusted actor identity, or a resolver `(ctx) => …` matching Eve's
   * `ApprovalPolicy`. Derive it from `ctx.session`; never trust
   * model-produced tool input as the actor identity.
   */
  actor?: ActorResolver<[ApprovalContext<TInput>]>;
  /**
   * Typed remote-policy inputs, or a resolver `(ctx) => …` over the approval
   * context. Build each value with {@link policyInput}.
   */
  inputs?: InputsResolver<[ApprovalContext<TInput>]>;
  /** Metadata merged over the session-derived context's. */
  metadata?: ArcjetMetadata | ((ctx: ApprovalContext<TInput>) => ArcjetMetadata);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
  /** Status returned on ALLOW. Default `"not-applicable"`. */
  onAllow?: ApprovalStatus;
  /** Reshape the status returned on DENY. */
  onDeny?: (decision: DecisionDeny) => ApprovalStatus;
  /**
   * Optional response-time policy. When set, `guardApproval` returns Eve's
   * `{ request, response }` form so the same slot can authorize the responder
   * after `onAllow: "user-approval"` parks the call.
   */
  response?: GuardApprovalResponsePolicy<TInput>;
}
/**
 * Policy evaluated against Eve's `ApprovalResponseContext` — who may approve a
 * parked HITL request. A rejection leaves the approval pending; it does not
 * deny the tool.
 */
export interface GuardApprovalResponsePolicy<TInput = Record<string, unknown>> {
  /** Guard label and capture action: `"resource.verb"`, past tense. */
  action: string;
  /** Rules to evaluate, static or computed from the response context. */
  rules?: RuleWithInput[] | ((ctx: ApprovalResponseContext<TInput>) => RuleWithInput[]);
  /**
   * Trusted actor identity, or a resolver `(ctx) => …` matching Eve's
   * response-time approval callback. Derive it from the responder session;
   * never trust model-produced tool input as the actor identity.
   */
  actor?: ActorResolver<[ApprovalResponseContext<TInput>]>;
  /**
   * Typed remote-policy inputs, or a resolver over the response context. Build
   * each value with {@link policyInput}.
   */
  inputs?: InputsResolver<[ApprovalResponseContext<TInput>]>;
  /** Metadata merged over the session-derived context's. */
  metadata?: ArcjetMetadata | ((ctx: ApprovalResponseContext<TInput>) => ArcjetMetadata);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
}
/**
 * Gate for Eve tool and connection calls using Arcjet guard policies.
 *
 * Returns an Eve `Approval` assignable to `ToolDefinition.approval`,
 * `OpenAPIConnectionDefinition.approval`, or `McpClientConnectionDefinition.approval`.
 *
 * When `policy.response` is omitted, the return value is Eve's function form
 * (`ApprovalPolicy`). When `response` is set, the return value is
 * `{ request, response }` (`ApprovalConfiguration`).
 *
 * The request-time function:
 * 1. Derives context from the Eve `ApprovalContext`
 * 2. Resolves rules and metadata (each may be a function of ctx)
 * 3. Calls the guard with merged metadata including `eve.phase: "approval"`, `eve.tool`, and `eve.call`
 * 4. On ALLOW (with no failed-open), resolves to `policy.onAllow` or `"not-applicable"`
 * 5. On DENY, resolves to `policy.onDeny(decision)` or a default denial status
 * 6. On unavailable (guard threw or failed open with `onGuardError: "deny"`), resolves to
 *    a denial status or `policy.onAllow` depending on the mode
 * 7. Never throws, for any input
 *
 * The optional response-time function authorizes the responder of a parked
 * HITL request. ALLOW resolves to `{ status: "allowed" }`; DENY or
 * unavailable-with-deny resolves to `{ status: "rejected", reason }` (the
 * approval stays pending). Capture metadata uses `eve.phase: "approval-response"`
 * and the responder as the actor. It also never throws.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardApproval } from "@arcjet/guard/vercel-eve/v0";
 * import { defineOpenAPIConnection } from "eve/connections";
 * import type { OpenAPIConnectionDefinition } from "eve/connections";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const callLimit = tokenBucket({ refillRate: 5, intervalSeconds: 60, maxTokens: 5 });
 *
 * // A connection's tools have no local `execute` to wrap, so the approval
 * // gate is the only enforcement point that reaches them. `onAllow` still
 * // requires a human after the policy passes. The optional `response` policy
 * // authorizes who may approve the parked request. Eve still allows one
 * // `approval` field per connection; it can be this function or the
 * // `{ request, response }` object `guardApproval` returns when `response` is set.
 * const weather: OpenAPIConnectionDefinition = defineOpenAPIConnection({
 *   description: "Weather API",
 *   spec: "https://api.example.com/openapi.json",
 *   approval: guardApproval(arcjet, {
 *     action: "weather.fetched",
 *     rules: (ctx) => [callLimit({ key: ctx.session.id, requested: 1 })],
 *     onAllow: "user-approval",
 *     response: {
 *       action: "weather.approved",
 *       rules: (ctx) => [callLimit({ key: ctx.responder.principalId, requested: 1 })],
 *     },
 *   }),
 * });
 *
 * export default weather;
 * ```
 */
export declare function guardApproval<TInput = Record<string, unknown>>(client: ArcjetAgentClient, policy: GuardApprovalPolicy<TInput> & {
  response: GuardApprovalResponsePolicy<TInput>;
}): ApprovalConfiguration<TInput>;
export declare function guardApproval<TInput = Record<string, unknown>>(client: ArcjetAgentClient, policy: GuardApprovalPolicy<TInput>): ApprovalPolicy<TInput>;
//#endregion