import { shouldWarn } from "../../agents/capture.js";
import { correlationIdProblem } from "../../agents/context.js";
//#region src/openai-agents/v0/context.ts
function asContextSource(source) {
	if (source === void 0 || source === null || typeof source !== "object") return;
	return source;
}
function asAppContext(value) {
	if (value === void 0 || value === null || typeof value !== "object" || Array.isArray(value)) return;
	return value;
}
/**
* The integrator-owned app object. On a `RunContext` / run-options envelope
* that is `source.context`. On a bare app object it is the source itself.
*/
function readAppContext(source) {
	if (source === void 0) return;
	const nested = asAppContext(source.context);
	if (nested !== void 0) return nested;
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
* Derive correlation and metadata from an OpenAI Agents `RunContext`, app
* context, or run-options copy. Never mints a new id. Never calls
* `createAgentContext`. Never calls `session.getSessionId()`.
*
* Preference order for `correlationId`:
* 1. Fields the integrator put on `runContext.context` (or a bare app
*    object): `correlationId`, then `sessionId`, then `conversationId`,
*    then `groupId`
* 2. Documented copies on the envelope: run option `conversationId`,
*    `RunConfig.groupId`, already-resolved `sessionId`
* 3. `init.sessionId` / `init.correlationId` (a caller-owned fallback)
*
* `traceId` is never read. An invalid candidate is skipped (and warned
* when `ARCJET_LOG_LEVEL` asks for warnings). If nothing valid remains,
* `correlationId` is omitted so the decision is uncorrelated rather than
* joined to a generated id nobody has.
*
* @example
* ```ts
* import { openaiAgentsContext } from "@arcjet/guard/openai-agents/v0";
*
* const appContext = { sessionId: conversationId };
* export function beforeRun() {
*   return openaiAgentsContext({ context: appContext, conversationId });
* }
* ```
*/
function openaiAgentsContext(source, init) {
	const envelope = asContextSource(source);
	const app = readAppContext(envelope);
	const fromApp = {
		correlationId: app?.correlationId,
		sessionId: app?.sessionId,
		conversationId: app?.conversationId,
		groupId: app?.groupId
	};
	const fromEnvelope = {
		conversationId: envelope?.conversationId,
		groupId: envelope?.groupId,
		sessionId: envelope?.sessionId,
		correlationId: envelope?.correlationId
	};
	const { id: correlationId, rejected } = firstValidId([
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
			value: fromApp.groupId,
			label: "context.groupId"
		},
		{
			value: fromEnvelope.conversationId,
			label: "conversationId"
		},
		{
			value: fromEnvelope.groupId,
			label: "groupId"
		},
		{
			value: fromEnvelope.sessionId,
			label: "sessionId"
		},
		{
			value: fromEnvelope.correlationId,
			label: "correlationId"
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
	if (rejected !== void 0 && correlationId === void 0 && shouldWarn()) console.warn(`@arcjet/guard: OpenAI Agents ${rejected} rejected; no valid session/conversation/group id, leaving the call uncorrelated`);
	const derivedMetadata = {};
	const session = firstString([
		fromApp.sessionId,
		fromEnvelope.sessionId,
		init?.sessionId
	]);
	if (session !== void 0) derivedMetadata["openai-agents.session"] = session;
	const conversation = firstString([fromApp.conversationId, fromEnvelope.conversationId]);
	if (conversation !== void 0) derivedMetadata["openai-agents.conversation"] = conversation;
	const group = firstString([fromApp.groupId, fromEnvelope.groupId]);
	if (group !== void 0) derivedMetadata["openai-agents.group"] = group;
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
export { openaiAgentsContext };
