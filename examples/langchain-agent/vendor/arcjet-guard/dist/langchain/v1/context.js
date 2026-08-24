import { shouldWarn } from "../../agents/capture.js";
import { correlationIdProblem } from "../../agents/context.js";
//#region src/langchain/v1/context.ts
function asContextSource(source) {
	if (source === void 0 || source === null || typeof source !== "object") return;
	return source;
}
function asAppContext(value) {
	if (value === void 0 || value === null || typeof value !== "object" || Array.isArray(value)) return;
	return value;
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
function readConfigurable(source) {
	if (source === void 0) return;
	if (source.configurable !== null && typeof source.configurable === "object") return source.configurable;
	if (source.runtime?.configurable !== null && typeof source.runtime?.configurable === "object") return source.runtime.configurable;
	if (source.config?.configurable !== null && typeof source.config?.configurable === "object") return source.config.configurable;
	if (source.thread_id !== void 0) return { thread_id: source.thread_id };
}
function readAppContext(source) {
	if (source === void 0) return;
	const fromRuntime = asAppContext(source.runtime?.context);
	if (fromRuntime !== void 0) return fromRuntime;
	const nested = asAppContext(source.context);
	if (nested !== void 0) return nested;
	return source;
}
/**
* Derive correlation and metadata from a LangChain `createAgent` invoke
* config or a `wrapToolCall` `request.runtime`. Never mints a new id.
* Never calls `createAgentContext`. Never reads `traceId`. Never treats
* `interrupt` / resume as correlation.
*
* Preference order for `correlationId`:
* 1. `configurable.thread_id` — what `wrapToolCall` sees on
*    `runtime.configurable` as of langchain 1.2.34
* 2. Caller-owned `sessionId`, then `conversationId`
* 3. `init.sessionId` / `init.correlationId`
*
* An invalid candidate is skipped (and warned when `ARCJET_LOG_LEVEL`
* asks for warnings). If nothing valid remains, `correlationId` is
* omitted so the decision is uncorrelated rather than joined to a
* generated id nobody has.
*
* @example
* ```ts
* import { langchainContext } from "@arcjet/guard/langchain/v1";
*
* export function fromInvoke(config: { configurable?: { thread_id?: string } }) {
*   return langchainContext(config);
* }
* ```
*/
function langchainContext(source, init) {
	const envelope = asContextSource(source);
	const configurable = readConfigurable(envelope);
	const app = readAppContext(envelope);
	const threadId = configurable?.["thread_id"];
	const fromApp = {
		correlationId: app?.correlationId,
		sessionId: app?.sessionId,
		conversationId: app?.conversationId
	};
	const fromEnvelope = {
		correlationId: envelope?.correlationId,
		sessionId: envelope?.sessionId,
		conversationId: envelope?.conversationId
	};
	const { id: correlationId, rejected } = firstValidId([
		{
			value: threadId,
			label: "thread_id"
		},
		{
			value: fromApp.correlationId,
			label: "context.correlationId"
		},
		{
			value: fromApp.sessionId,
			label: "context.sessionId"
		},
		{
			value: fromApp.conversationId,
			label: "context.conversationId"
		},
		{
			value: fromEnvelope.correlationId,
			label: "correlationId"
		},
		{
			value: fromEnvelope.sessionId,
			label: "sessionId"
		},
		{
			value: fromEnvelope.conversationId,
			label: "conversationId"
		},
		{
			value: init?.correlationId,
			label: "init.correlationId"
		},
		{
			value: init?.sessionId,
			label: "init.sessionId"
		}
	]);
	if (rejected !== void 0 && correlationId === void 0 && shouldWarn()) console.warn(`@arcjet/guard: LangChain ${rejected} rejected; no valid thread/session/conversation id, leaving the call uncorrelated`);
	const derivedMetadata = {};
	const thread = firstString([threadId]);
	if (thread !== void 0) derivedMetadata["langchain.thread"] = thread;
	const session = firstString([
		fromApp.sessionId,
		fromEnvelope.sessionId,
		init?.sessionId
	]);
	if (session !== void 0) derivedMetadata["langchain.session"] = session;
	const conversation = firstString([fromApp.conversationId, fromEnvelope.conversationId]);
	if (conversation !== void 0) derivedMetadata["langchain.conversation"] = conversation;
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
export { langchainContext };
