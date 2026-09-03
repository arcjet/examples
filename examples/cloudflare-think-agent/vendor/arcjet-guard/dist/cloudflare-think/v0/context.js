import { shouldWarn } from "../../agents/capture.js";
import { correlationIdProblem } from "../../agents/context.js";
//#region src/cloudflare-think/v0/context.ts
function asContextSource(source) {
	if (source === void 0 || source === null || typeof source !== "object") return;
	return source;
}
function asAppContext(value) {
	if (value === void 0 || value === null || typeof value !== "object" || Array.isArray(value)) return;
	return value;
}
/**
* Think's `ToolCallContext` always carries `toolCallId` and `toolName`.
* Those fields are SDK-minted, so an envelope that looks like one must
* not be mined for correlation.
*/
function isThinkToolCallEnvelope(source) {
	return typeof source.toolCallId === "string" && typeof source.toolName === "string";
}
/**
* The integrator-owned app object. On a `ToolCallContext` envelope that
* is `source.context` if the caller attached one. On a bare app object
* it is the source itself.
*/
function readAppContext(source) {
	if (source === void 0) return;
	const nested = asAppContext(source.context);
	if (nested !== void 0) return nested;
	if (isThinkToolCallEnvelope(source)) return;
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
* Derive correlation and metadata from a Cloudflare Think hook context
* or a caller-owned bag. Never mints a new id. Never calls
* `createAgentContext`. Never reads `toolCallId` (Think / AI SDK always
* generates it). Never reads a Durable Object `name` / `id`. Never
* reads `traceId`.
*
* Preference order for `correlationId`:
* 1. Fields the integrator put on a caller-owned wrap
*    (`cloudflareThinkContext({ context: appContext })`):
*    `correlationId`, then `sessionId`, then `conversationId`
* 2. Documented copies on a bare app object (not a Think tool-call envelope)
* 3. `init.sessionId` / `init.correlationId` (a caller-owned fallback)
*
* Prefer `guardHooks({ sessionId })` or
* `cloudflareThinkContext({ context: appContext })`. A `beforeToolCall`
* context that has `toolCallId` and `toolName` is treated as a Think
* envelope, so a top-level `sessionId` on that object is ignored.
*
* An invalid candidate is skipped (and warned when `ARCJET_LOG_LEVEL`
* asks for warnings). If nothing valid remains, `correlationId` is
* omitted so the decision is uncorrelated rather than joined to a
* generated id nobody has.
*
* @example
* ```ts
* import { cloudflareThinkContext } from "@arcjet/guard/cloudflare-think/v0";
*
* const appContext = { sessionId: conversationId };
* export function beforeChat() {
*   return cloudflareThinkContext({ context: appContext });
* }
* ```
*/
function cloudflareThinkContext(source, init) {
	const envelope = asContextSource(source);
	const app = readAppContext(envelope);
	const envelopeIsThink = envelope !== void 0 && isThinkToolCallEnvelope(envelope);
	const fromApp = {
		correlationId: app?.correlationId,
		sessionId: app?.sessionId,
		conversationId: app?.conversationId
	};
	const fromEnvelope = envelopeIsThink ? {
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
	if (rejected !== void 0 && correlationId === void 0 && shouldWarn()) console.warn(`@arcjet/guard: Cloudflare Think ${rejected} rejected; no valid session/conversation id, leaving the call uncorrelated`);
	const derivedMetadata = {};
	const session = validMetadataString([
		fromApp.sessionId,
		fromEnvelope.sessionId,
		init?.sessionId
	]);
	if (session !== void 0) derivedMetadata["cloudflare-think.session"] = session;
	const conversation = validMetadataString([fromApp.conversationId, fromEnvelope.conversationId]);
	if (conversation !== void 0) derivedMetadata["cloudflare-think.conversation"] = conversation;
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
export { cloudflareThinkContext };
