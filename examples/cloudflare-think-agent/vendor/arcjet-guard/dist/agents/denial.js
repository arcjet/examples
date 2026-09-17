//#region src/agents/denial.ts
/**
* Upper bound on a retry hint.
*
* A reset near the uint32 ceiling would otherwise yield a nonsensical wait
* here, and a negative one on a 32-bit consumer.
*/
const MAX_RETRY_AFTER_SECONDS = 86400;
/**
* Seconds until a rate-limited call may be retried, or `undefined` when no
* denying rate-limit rule carries a usable reset.
*
* Only meaningful for a `RATE_LIMIT` denial; the reason check stays with the
* caller rather than being duplicated here. Among the results, only rules that
* denied are considered, and the latest reset among them is reported — that is
* when the call would actually be permitted, whereas the earliest (or the
* first in submission order) invites a retry that the longer rule denies
* again.
*
* @internal Exported for use by the vendor namespaces, so every one of them
* reports the same retry-after; not part of the public API.
*/
function retryAfterSeconds(decision) {
	let latest;
	for (const result of decision.results) {
		if (result.conclusion !== "DENY") continue;
		if (!("resetAtUnixSeconds" in result) || typeof result.resetAtUnixSeconds !== "number") continue;
		const reset = result.resetAtUnixSeconds;
		if (reset <= 0) continue;
		if (latest === void 0 || reset > latest) latest = reset;
	}
	if (latest === void 0) return void 0;
	return Math.min(Math.max(0, Math.ceil(latest - Date.now() / 1e3)), MAX_RETRY_AFTER_SECONDS);
}
/** Model- and user-readable explanation of a denial. */
function deniedReason(decision) {
	const isRateLimit = decision.reason === "RATE_LIMIT";
	let message;
	if (isRateLimit) {
		const retryAfter = retryAfterSeconds(decision);
		message = `Arcjet denied this call (${decision.reason}). It may be retried` + (retryAfter === void 0 ? " later." : ` after ${retryAfter} seconds.`);
	} else message = `Arcjet denied this call (${decision.reason}). Do not retry; explain the denial to the user or try a different approach.`;
	return message;
}
/** Explanation used when the policy could not be evaluated. */
function unavailableReason() {
	return "Arcjet security check could not be completed; please retry later.";
}
/**
* Backoff hint returned to the model when the guard is unavailable.
*
* A rate-limit denial derives its hint from the denying rule's
* `resetAtUnixSeconds`. This path has nothing to derive from. Five seconds
* paces a model's retry loop.
*/
const UNAVAILABLE_RETRY_AFTER_SECONDS = 5;
function denialResult(decision) {
	const isRateLimit = decision.reason === "RATE_LIMIT";
	let retryAfterSecs;
	if (isRateLimit) retryAfterSecs = retryAfterSeconds(decision);
	const result = {
		arcjetDenied: true,
		reason: decision.reason,
		message: deniedReason(decision),
		retryable: isRateLimit
	};
	if (isRateLimit && retryAfterSecs !== void 0) result.retryAfterSeconds = retryAfterSecs;
	return result;
}
function unavailableResult() {
	return {
		arcjetDenied: true,
		reason: "ERROR",
		message: unavailableReason(),
		retryable: true,
		retryAfterSeconds: 5
	};
}
//#endregion
export { UNAVAILABLE_RETRY_AFTER_SECONDS, denialResult, deniedReason, retryAfterSeconds, unavailableReason, unavailableResult };
