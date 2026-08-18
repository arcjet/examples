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
function denialToolResult(decision, extras) {
	return asToolResult(denialResult(decision), extras);
}
function unavailableToolResult(extras) {
	return asToolResult(unavailableResult(), extras);
}
/**
* Lift a denial payload (or a caller `onDeny` object) into the tool-result
* shape. A value that already looks like a tool result is returned as-is.
*/
function asToolResult(value, extras) {
	if (isToolResult(value)) return value;
	const denial = isDenialResult(value) ? value : {
		arcjetDenied: true,
		reason: "ERROR",
		message: typeof value === "string" ? value : unavailableReason(),
		retryable: false
	};
	const name = extras?.name ?? "";
	const toolCallId = extras?.toolCallId ?? "";
	return {
		...denial,
		status: "error",
		content: denial.message,
		type: "tool",
		name,
		tool_call_id: toolCallId,
		getType: () => "tool"
	};
}
function isDenialResult(value) {
	return value !== null && typeof value === "object" && "arcjetDenied" in value && value.arcjetDenied === true && "reason" in value && typeof value.reason === "string" && "message" in value && typeof value.message === "string";
}
function isToolResult(value) {
	return isDenialResult(value) && "status" in value && value.status === "error" && "getType" in value && typeof value.getType === "function";
}
//#endregion
export { UNAVAILABLE_RETRY_AFTER_SECONDS, asToolResult, denialResult, denialToolResult, deniedReason, unavailableReason, unavailableResult, unavailableToolResult };
