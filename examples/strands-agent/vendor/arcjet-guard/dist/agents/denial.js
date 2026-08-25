/**
 * Seconds until a rate-limited call may be retried, or `undefined` when the
 * decision carries no reset time to derive one from.
 *
 * Only meaningful for a `RATE_LIMIT` denial. A co-occurring rule that allowed
 * can still leave a `resetAtUnixSeconds` in `decision.results`, so the caller
 * decides whether to consult this at all — the reason check stays with the
 * caller rather than being duplicated here.
 *
 * @internal Exported for use by the vendor namespaces, so every one of them
 * reports the same retry-after; not part of the public API.
 */
export function retryAfterSeconds(decision) {
    for (const result of decision.results) {
        if ("resetAtUnixSeconds" in result && typeof result.resetAtUnixSeconds === "number") {
            return Math.max(0, Math.ceil(result.resetAtUnixSeconds - Date.now() / 1000));
        }
    }
    return undefined;
}
/** Model- and user-readable explanation of a denial. */
export function deniedReason(decision) {
    const isRateLimit = decision.reason === "RATE_LIMIT";
    let message;
    if (isRateLimit) {
        const retryAfter = retryAfterSeconds(decision);
        message =
            `Arcjet denied this call (${decision.reason}). It may be retried` +
                (retryAfter === undefined ? " later." : ` after ${retryAfter} seconds.`);
    }
    else {
        message = `Arcjet denied this call (${decision.reason}). Do not retry; explain the denial to the user or try a different approach.`;
    }
    return message;
}
/** Explanation used when the policy could not be evaluated. */
export function unavailableReason() {
    return "Arcjet security check could not be completed; please retry later.";
}
/**
 * Backoff hint returned to the model when the guard is unavailable.
 *
 * A rate-limit denial derives its hint from the denying rule's
 * `resetAtUnixSeconds`. This path has nothing to derive from. Five seconds
 * paces a model's retry loop.
 */
export const UNAVAILABLE_RETRY_AFTER_SECONDS = 5;
export function denialResult(decision) {
    const isRateLimit = decision.reason === "RATE_LIMIT";
    let retryAfterSecs;
    // Only rate-limit denials are retryable, so only they carry a retry-after.
    // A co-occurring rule that allowed can still leave a resetAtUnixSeconds in
    // decision.results; ignore it when the denying reason is not a rate limit.
    if (isRateLimit) {
        retryAfterSecs = retryAfterSeconds(decision);
    }
    const result = {
        arcjetDenied: true,
        reason: decision.reason,
        message: deniedReason(decision),
        retryable: isRateLimit,
    };
    if (isRateLimit && retryAfterSecs !== undefined) {
        result.retryAfterSeconds = retryAfterSecs;
    }
    return result;
}
export function unavailableResult() {
    return {
        arcjetDenied: true,
        reason: "ERROR",
        message: unavailableReason(),
        retryable: true,
        retryAfterSeconds: UNAVAILABLE_RETRY_AFTER_SECONDS,
    };
}
