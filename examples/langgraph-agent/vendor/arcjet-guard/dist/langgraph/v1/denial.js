import { retryAfterSeconds } from "../../agents/denial.js";
//#region src/langgraph/v1/denial.ts
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
export { UNAVAILABLE_RETRY_AFTER_SECONDS, denialResult, deniedReason, unavailableReason, unavailableResult };
