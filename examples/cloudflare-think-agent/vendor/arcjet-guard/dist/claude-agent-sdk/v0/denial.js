import { denialResult, unavailableResult } from "../../agents/denial.js";
//#region src/claude-agent-sdk/v0/denial.ts
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
* Claude reads the composed message instead of a raw exception, and omitting
* `isError` would look like a successful tool call. The payload carried on
* `structuredContent` is the shared contract from `agents/denial.ts`.
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
export { asCallToolResult, denialCallToolResult, unavailableCallToolResult };
