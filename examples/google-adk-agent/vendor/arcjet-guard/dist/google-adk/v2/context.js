import { shouldWarn } from "../../agents/capture.js";
import { correlationIdProblem } from "../../agents/context.js";
//#region src/google-adk/v2/context.ts
function asContextSource(source) {
	if (source === void 0 || source === null || typeof source !== "object") return;
	return source;
}
function asRecord(value) {
	if (value === void 0 || value === null || typeof value !== "object" || Array.isArray(value)) return;
	return value;
}
function asAppContext(value) {
	return asRecord(value);
}
/**
* ADK `ReadonlyContext` / `Context` always carries `invocationId` (see
* `newInvocationContextId()`). An envelope that looks like one must not
* be mined for `sessionId` — that field is the session service id and
* can be ephemeral.
*/
function isAdkContextEnvelope(source) {
	return typeof source.invocationId === "string";
}
function readStateBag(state) {
	if (state === void 0 || state === null || typeof state !== "object") return;
	const withToRecord = state;
	if (typeof withToRecord.toRecord === "function") return asRecord(withToRecord.toRecord());
	const withGet = state;
	if (typeof withGet.get === "function") {
		const get = withGet.get.bind(state);
		return {
			correlationId: get("correlationId"),
			sessionId: get("sessionId"),
			conversationId: get("conversationId")
		};
	}
	return asRecord(state);
}
/**
* The integrator-owned app object. On a `toolContext` envelope that is
* `source.context` or caller keys on `state`. On a bare app object it
* is the source itself.
*/
function readAppContext(source) {
	if (source === void 0) return;
	const nested = asAppContext(source.context);
	if (nested !== void 0) return nested;
	if (isAdkContextEnvelope(source)) return;
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
function validMetadataString(values) {
	for (const value of values) {
		if (typeof value !== "string" || value.length === 0) continue;
		if (correlationIdProblem(value) !== void 0) continue;
		return value;
	}
}
/**
* Derive correlation and metadata from a Google ADK `toolContext`,
* session `state`, or a caller-owned bag. Never mints a new id. Never
* calls `createAgentContext`. Never reads `invocationId` (ADK always
* generates it). Never reads `traceId` / `functionCallId`. Never reads
* `toolContext.sessionId` / `session.id` (session auto-ids).
*
* Preference order for `correlationId`:
* 1. Fields the integrator put on a nested `context` bag:
*    `correlationId`, then `sessionId`, then `conversationId`
* 2. The same keys on session `state` (`toRecord()` / `get()` / object)
* 3. Documented copies on a bare app object (not an ADK Context envelope)
* 4. `init.sessionId` / `init.correlationId` (a caller-owned fallback)
*
* Prefer `googleAdkContext({ context: appContext })` or put the id on
* `state` / helper options. A `toolContext` that has `invocationId` is
* treated as an ADK envelope, so a top-level `sessionId` on that object
* is ignored.
*
* An invalid candidate is skipped (and warned when `ARCJET_LOG_LEVEL`
* asks for warnings). If nothing valid remains, `correlationId` is
* omitted so the decision is uncorrelated rather than joined to a
* generated id nobody has.
*
* @example
* ```ts
* import { googleAdkContext } from "@arcjet/guard/google-adk/v2";
*
* const appContext = { sessionId: conversationId };
* export function beforeRun() {
*   return googleAdkContext({ context: appContext });
* }
* ```
*/
function googleAdkContext(source, init) {
	const envelope = asContextSource(source);
	const app = readAppContext(envelope);
	const state = readStateBag(envelope?.state);
	const envelopeIsAdk = envelope !== void 0 && isAdkContextEnvelope(envelope);
	const fromApp = {
		correlationId: app?.correlationId,
		sessionId: app?.sessionId,
		conversationId: app?.conversationId
	};
	const fromState = {
		correlationId: state?.["correlationId"],
		sessionId: state?.["sessionId"],
		conversationId: state?.["conversationId"]
	};
	const fromEnvelope = envelopeIsAdk ? {
		correlationId: void 0,
		sessionId: void 0,
		conversationId: void 0
	} : {
		correlationId: envelope?.correlationId,
		sessionId: envelope?.sessionId,
		conversationId: envelope?.conversationId
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
			value: fromState.correlationId,
			label: "state.correlationId"
		},
		{
			value: fromState.sessionId,
			label: "state.sessionId"
		},
		{
			value: fromState.conversationId,
			label: "state.conversationId"
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
	if (rejected !== void 0 && correlationId === void 0 && shouldWarn()) console.warn(`@arcjet/guard: Google ADK ${rejected} rejected; no valid session/conversation id, leaving the call uncorrelated`);
	const derivedMetadata = {};
	const session = validMetadataString([
		fromApp.sessionId,
		fromState.sessionId,
		fromEnvelope.sessionId,
		init?.sessionId
	]);
	if (session !== void 0) derivedMetadata["google-adk.session"] = session;
	const conversation = validMetadataString([
		fromApp.conversationId,
		fromState.conversationId,
		fromEnvelope.conversationId
	]);
	if (conversation !== void 0) derivedMetadata["google-adk.conversation"] = conversation;
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
export { googleAdkContext };
