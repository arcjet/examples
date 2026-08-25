import { shouldWarn } from "../../agents/capture.js";
import { correlationIdProblem } from "../../agents/context.js";
//#region src/strands-agents/v1/context.ts
function asRecord(value) {
	if (value === void 0 || value === null || typeof value !== "object" || Array.isArray(value)) return;
	return value;
}
function asContextSource(source) {
	if (source === void 0 || source === null || typeof source !== "object") return;
	return source;
}
/**
* The caller-owned bag. On a tool / hook envelope that is
* `source.invocationState`. On a bare bag it is the source itself.
*/
function readInvocationState(source) {
	if (source === void 0) return;
	const nested = asRecord(source.invocationState);
	if (nested !== void 0) return nested;
	return asRecord(source);
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
* Derive correlation and metadata from a Strands `invocationState` bag
* or a tool / hook envelope that carries one. Never mints a new id.
* Never calls `createAgentContext`. Never reads `traceId`. Never reads
* `agent.id`. Never calls `SessionManager`.
*
* Preference order for `correlationId`:
* 1. Fields the integrator put on `invocationState`: `correlationId`,
*    then `sessionId`, then `requestId`
* 2. Documented copies on the envelope
* 3. `init.sessionId` / `init.correlationId` (a caller-owned fallback)
*
* An invalid candidate is skipped (and warned when `ARCJET_LOG_LEVEL`
* asks for warnings). If nothing valid remains, `correlationId` is
* omitted so the decision is uncorrelated rather than joined to a
* generated id nobody has.
*
* @example
* ```ts
* import { strandsAgentContext } from "@arcjet/guard/strands-agents/v1";
*
* const invocationState = { sessionId: conversationId };
* export function beforeInvoke() {
*   return strandsAgentContext({ invocationState });
* }
* ```
*/
function strandsAgentContext(source, init) {
	const envelope = asContextSource(source);
	const state = readInvocationState(envelope);
	const fromState = {
		correlationId: state?.["correlationId"],
		sessionId: state?.["sessionId"],
		requestId: state?.["requestId"]
	};
	const fromEnvelope = {
		correlationId: envelope?.correlationId,
		sessionId: envelope?.sessionId,
		requestId: envelope?.requestId
	};
	const { id: correlationId, rejected } = firstValidId([
		{
			value: fromState.correlationId,
			label: "invocationState.correlationId"
		},
		{
			value: fromState.sessionId,
			label: "invocationState.sessionId"
		},
		{
			value: fromState.requestId,
			label: "invocationState.requestId"
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
			value: fromEnvelope.requestId,
			label: "requestId"
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
	if (rejected !== void 0 && correlationId === void 0 && shouldWarn()) console.warn(`@arcjet/guard: Strands Agents ${rejected} rejected; no valid session/request id, leaving the call uncorrelated`);
	const derivedMetadata = {};
	const session = validMetadataString([
		fromState.sessionId,
		fromEnvelope.sessionId,
		init?.sessionId
	]);
	if (session !== void 0) derivedMetadata["strands.session"] = session;
	const request = validMetadataString([fromState.requestId, fromEnvelope.requestId]);
	if (request !== void 0) derivedMetadata["strands.request"] = request;
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
export { strandsAgentContext };
