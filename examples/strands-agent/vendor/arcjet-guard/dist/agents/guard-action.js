import { captureEvent } from "./capture.js";
import { runGuarded } from "./guarded.js";
/**
 * Thrown by `guardAction()` when guard denies the action. Carries the
 * denying decision so callers can branch on `error.decision.reason`,
 * catch-and-skip, or abort the workflow.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardAction, ArcjetDeniedError, createAgentContext } from "@arcjet/guard/vercel-ai/v7";
 *
 * const arcjet = launchArcjet({ key: process.env.ARCJET_KEY! });
 * const ctx = createAgentContext({ correlationId: "workflow-123" });
 *
 * const commentLimit = tokenBucket({
 *   refillRate: 5,
 *   intervalSeconds: 60,
 *   maxTokens: 5,
 * });
 *
 * try {
 *   await guardAction(
 *     arcjet,
 *     ctx,
 *     {
 *       action: "github.pr-commented",
 *       onGuardError: "deny", // default — blocks the call if Arcjet is unreachable
 *       rules: [commentLimit({ key: userId })],
 *     },
 *     async () => {
 *       // This function runs only on ALLOW
 *       return await github.createComment({ body: "Review completed" });
 *     },
 *   );
 * } catch (error) {
 *   if (error instanceof ArcjetDeniedError) {
 *     // Handle denial: log, notify, skip this step
 *     console.log(`Rate limited: ${error.decision.reason}`);
 *   } else {
 *     throw error;
 *   }
 * }
 * ```
 */
export class ArcjetDeniedError extends Error {
    decision;
    constructor(action, decision) {
        super(`Arcjet denied action "${action}" (${decision.reason}); decision ${decision.id}`);
        this.name = "ArcjetDeniedError";
        this.decision = decision;
    }
}
/**
 * Thrown by `guardAction()` when the guard policy could not be evaluated due to
 * an unavailable guard service. Carries information about why evaluation failed
 * (either the guard call threw or a decision failed open) so operators can
 * distinguish SDK errors from infrastructure outages.
 *
 * When `onGuardError: "deny"` is set (the default), both guard-unavailable
 * signals are caught and result in this error. This is distinct from
 * `ArcjetDeniedError`, which is thrown when a rule actively denies the action.
 */
// oxlint-disable-next-line eslint/max-classes-per-file -- Paired exception class for unavailable vs denied paths
export class ArcjetGuardUnavailableError extends Error {
    action;
    decision;
    constructor(action, init) {
        super(`policy for "${action}" could not be evaluated`, "cause" in init ? { cause: init.cause } : {});
        this.name = "ArcjetGuardUnavailableError";
        this.action = action;
        if ("decision" in init) {
            this.decision = init.decision;
        }
    }
}
/**
 * Guard an action and run a callback, throwing `ArcjetDeniedError` on denial or
 * `ArcjetGuardUnavailableError` when guard is unavailable (depending on
 * `policy.onGuardError`).
 *
 * Always runs `guard()`, submitting `policy.rules` or none; on DENY it throws
 * `ArcjetDeniedError` without running `fn`. On ALLOW — which is what submitting
 * no rules returns — `fn` runs and the outcome is captured. With the default
 * `onGuardError: "deny"`, guard API errors and failed-open decisions throw
 * `ArcjetGuardUnavailableError` without running `fn`. With `onGuardError:
 * "allow"`, both signals fail open: `fn` still runs, with a warning gated on
 * `ARCJET_LOG_LEVEL`.
 *
 * @param client - Guard client from `launchArcjet()`
 * @param ctx - Security context with correlation ID and metadata
 * @param policy - Execution policy: `action` (required), `rules`, `metadata`, `onGuardError`
 * @param fn - Async function to execute on ALLOW; never called on DENY or (by default) when unavailable
 * @returns The return value of `fn` on success
 * @throws {ArcjetDeniedError} When guard denies the action
 * @throws {ArcjetGuardUnavailableError} When guard is unavailable and `onGuardError: "deny"` (the default)
 * @throws Any error thrown by `fn`
 *
 * @example
 * ```ts
 * import { launchArcjet, fixedWindow } from "@arcjet/guard";
 * import { guardAction, createAgentContext } from "@arcjet/guard/vercel-ai/v7";
 *
 * const arcjet = launchArcjet({ key: process.env.ARCJET_KEY! });
 * const limit = fixedWindow({ maxRequests: 10, windowSeconds: 60 });
 * const ctx = createAgentContext({ correlationId: "workflow-456" });
 *
 * const result = await guardAction(
 *   arcjet,
 *   ctx,
 *   {
 *     action: "database.updated",
 *     onGuardError: "deny", // default — blocks the call if Arcjet is unreachable
 *     rules: [limit({ key: userId })],
 *   },
 *   async () => {
 *     return await db.update({ id: recordId, data });
 *   },
 * );
 * ```
 */
// oxlint-disable-next-line eslint/require-await -- Async wrapper for runGuarded
export async function guardAction(client, ctx, policy, fn) {
    return runGuarded(client, {
        action: policy.action,
        rules: policy.rules,
        ...(policy.actor !== undefined && { actor: policy.actor }),
        ...(policy.inputs !== undefined && { inputs: policy.inputs }),
        correlationId: ctx.correlationId,
        metadata: { ...ctx.metadata, ...policy.metadata },
        onDeny: (decision) => {
            throw new ArcjetDeniedError(policy.action, decision);
        },
        onUnavailable: (unavailable) => {
            if (unavailable.kind === "threw") {
                throw new ArcjetGuardUnavailableError(policy.action, {
                    cause: unavailable.error,
                });
            }
            throw new ArcjetGuardUnavailableError(policy.action, {
                decision: unavailable.decision,
            });
        },
        execute: fn,
        onGuardError: policy.onGuardError ?? "deny",
    });
}
/**
 * Observe-only sugar over the client's `capture()`: records that the
 * application did something, correlated to the run. Fire-and-forget; never
 * throws.
 *
 * Unlike `guardAction()`, this does not invoke the guard; it records a bare
 * fact about what the application did. No `outcome` metadata is added (that's
 * only for guarded executions).
 *
 * @param client - Guard client from `launchArcjet()`
 * @param ctx - Security context with correlation ID and metadata
 * @param opts - Capture options: `action` (required), `metadata` (optional)
 *
 * @example
 * ```ts
 * captureAction(arcjetClient, ctx, {
 *   action: "notification.sent",
 *   metadata: { channel: "slack", recipient: "user-123" },
 * });
 * ```
 */
export function captureAction(client, ctx, opts) {
    captureEvent(client, {
        action: opts.action,
        correlationId: ctx.correlationId,
        metadata: { ...ctx.metadata, ...opts.metadata },
    });
}
