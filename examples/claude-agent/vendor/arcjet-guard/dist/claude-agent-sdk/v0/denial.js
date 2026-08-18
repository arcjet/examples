import { retryAfterSeconds } from "../../agents/denial.js";
//#region src/claude-agent-sdk/v0/denial.ts
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
function asStructuredContent(value) {
	const content = {
		arcjetDenied: value.arcjetDenied,
		reason: value.reason,
		message: value.message,
		retryable: value.retryable
	};
	if (value.retryAfterSeconds !== void 0) content["retryAfterSeconds"] = value.retryAfterSeconds;
	return content;
}
/**
* DENY as a `CallToolResult` with `isError: true`. Prefer this over throwing:
* Claude reads the composed message instead of a raw exception.
*/
function denialCallToolResult(decision) {
	const result = denialResult(decision);
	return {
		content: [{
			type: "text",
			text: result.message
		}],
		structuredContent: asStructuredContent(result),
		isError: true
	};
}
function unavailableCallToolResult() {
	const result = unavailableResult();
	return {
		content: [{
			type: "text",
			text: result.message
		}],
		structuredContent: asStructuredContent(result),
		isError: true
	};
}
function isCallToolResult(value) {
	if (value === null || typeof value !== "object") return false;
	return Array.isArray(value.content);
}
/**
* Coerce an `onDeny` return value into a `CallToolResult`. A value that
* already has a `content` array is used as-is; any other object becomes
* `structuredContent` on an `isError: true` result.
*/
function asCallToolResult(value, fallback) {
	if (isCallToolResult(value)) return value;
	if (value !== null && typeof value === "object") {
		const structuredContent = {};
		for (const [key, entry] of Object.entries(value)) structuredContent[key] = entry;
		return {
			content: fallback.content,
			structuredContent,
			isError: true
		};
	}
	return fallback;
}
//#endregion
export { UNAVAILABLE_RETRY_AFTER_SECONDS, asCallToolResult, denialCallToolResult, denialResult, deniedReason, unavailableCallToolResult, unavailableReason, unavailableResult };
