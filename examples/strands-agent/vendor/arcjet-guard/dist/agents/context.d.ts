import type { ArcjetMetadata } from "../types.ts";
/**
 * Name what is wrong with a caller-supplied correlation ID, or `undefined` if
 * it is valid.
 *
 * The `typeof` check comes first because `RegExp.test()` coerces its argument,
 * so a number would otherwise satisfy the pattern.
 *
 * @internal Exported for use by the vendor namespaces, so every one of them
 * rejects the same correlation ids; not part of the public API.
 */
export declare function correlationIdProblem(value: unknown): string | undefined;
/**
 * Security context threaded through guard evaluations.
 *
 * Plain JSON-serializable object containing a correlation ID and optional
 * metadata. Thread it explicitly through function calls and workflow/queue
 * inputs (never use module state or `AsyncLocalStorage`). The correlation ID
 * joins all decisions and events for this request into one observable sequence
 * in the Arcjet console.
 *
 * Generated automatically as a ULID if not provided; validation ensures
 * caller-supplied IDs fit within 1–256 printable ASCII characters.
 */
export interface ArcjetAgentContext {
    /**
     * Correlation ID for tracing this request across services.
     * Generated as a ULID if not supplied; validates to 1–256 printable ASCII
     * characters when supplied by the caller.
     */
    correlationId: string;
    /**
     * Optional metadata fields (security dimensions, audit context, etc.).
     */
    metadata?: ArcjetMetadata;
}
/**
 * Create an ArcjetAgentContext with a correlation ID and optional metadata.
 *
 * If no `correlationId` is supplied, a ULID is generated automatically.
 * If a `correlationId` is supplied, it is validated to be 1–256 characters
 * of printable ASCII; anything else throws an error (not truncated).
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { createAgentContext, guardAction } from "@arcjet/guard/vercel-ai/v7";
 *
 * const client = launchArcjet({ key: process.env.ARCJET_KEY! });
 * const limit = tokenBucket({ refillRate: 5, intervalSeconds: 60, maxTokens: 5 });
 *
 * // One context per request, threaded explicitly into each guarded call.
 * const ctx = createAgentContext({ correlationId: "workflow-123" });
 *
 * const posted = await guardAction(
 *   client,
 *   ctx,
 *   {
 *     action: "comment.posted",
 *     onGuardError: "deny", // default — blocks the call if Arcjet is unreachable
 *     rules: [limit({ key: userId })],
 *   },
 *   () => postComment(body),
 * );
 * console.log(posted);
 * ```
 *
 * @param init - Optional initialization object with `correlationId` and `metadata`
 * @returns A new ArcjetAgentContext with validated correlation ID and metadata
 * @throws {Error} If a supplied correlationId is invalid (too long, non-ASCII, empty)
 */
export declare function createAgentContext(init?: {
    correlationId?: string;
    metadata?: ArcjetMetadata;
}): ArcjetAgentContext;
