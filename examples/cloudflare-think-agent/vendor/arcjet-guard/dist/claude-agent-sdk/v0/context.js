import { shouldWarn } from "../../agents/capture.js";
import { correlationIdProblem } from "../../agents/context.js";
//#region src/claude-agent-sdk/v0/context.ts
function asContextSource(source) {
	if (source === void 0 || source === null || typeof source !== "object") return;
	return source;
}
function firstValidId(candidates) {
	let rejected;
	for (const candidate of candidates) {
		if (typeof candidate.value !== "string") continue;
		const problem = correlationIdProblem(candidate.value);
		if (problem === void 0) return {
			id: candidate.value,
			rejected: void 0
		};
		rejected = `${candidate.label} (${problem})`;
	}
	return {
		id: void 0,
		rejected
	};
}
function firstString(values) {
	for (const value of values) if (typeof value === "string" && value.length > 0) return value;
}
/**
* Derive correlation and metadata from a Claude Agent SDK hook input or
* `query({ options.sessionId })`. Never mints a new id.
*
* Preference order for `correlationId`:
* 1. Hook input `session_id`
* 2. Source `sessionId` (options-shaped objects)
* 3. `init.sessionId` (`options.sessionId` passed explicitly)
*
* Subagent `agent_id` is metadata only. An invalid candidate is skipped (and
* warned when `ARCJET_LOG_LEVEL` asks for warnings). If nothing valid remains,
* `correlationId` is omitted so the decision is uncorrelated rather than
* joined to a generated id nobody has.
*
* @example
* ```ts
* import { claudeAgentContext } from "@arcjet/guard/claude-agent-sdk/v0";
*
* export function fromHook(input: { session_id: string; agent_id?: string }) {
*   return claudeAgentContext(input);
* }
* ```
*/
function claudeAgentContext(source, init) {
	const ctx = asContextSource(source);
	const { id: correlationId, rejected } = firstValidId([
		{
			value: ctx?.session_id,
			label: "session_id"
		},
		{
			value: ctx?.sessionId,
			label: "sessionId"
		},
		{
			value: init?.sessionId,
			label: "options.sessionId"
		}
	]);
	if (rejected !== void 0 && correlationId === void 0 && shouldWarn()) console.warn(`@arcjet/guard: Claude ${rejected} rejected; no valid session id, leaving the call uncorrelated`);
	const derivedMetadata = {};
	const session = firstString([
		ctx?.session_id,
		ctx?.sessionId,
		init?.sessionId
	]);
	if (session !== void 0) derivedMetadata["claude.session"] = session;
	if (typeof ctx?.agent_id === "string" && ctx.agent_id.length > 0) derivedMetadata["claude.agent"] = ctx.agent_id;
	if (typeof ctx?.agent_type === "string" && ctx.agent_type.length > 0) derivedMetadata["claude.agent-type"] = ctx.agent_type;
	const metadata = {
		...derivedMetadata,
		...init?.metadata
	};
	const result = {};
	if (correlationId !== void 0) result.correlationId = correlationId;
	if (Object.keys(metadata).length > 0) result.metadata = metadata;
	return result;
}
//#endregion
export { claudeAgentContext };
