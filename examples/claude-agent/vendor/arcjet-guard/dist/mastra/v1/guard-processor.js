import { mastraAgentContext } from "./context.js";
import { deniedReason, unavailableReason } from "./denial.js";
import { runGate } from "./gate.js";
//#region src/mastra/v1/guard-processor.ts
function isRequestContextLike(value) {
	return value !== null && typeof value === "object" && "get" in value && typeof value.get === "function";
}
/** Module-scoped so it cannot collide with a Mastra-owned string key or leak if `state` is serialised. */
const inputScreened = Symbol("arcjet.inputScreened");
function textFromPart(part) {
	if (typeof part !== "object" || part === null) return "";
	const typed = part;
	if (typed.type === "text" && typeof typed.text === "string") return typed.text;
	return "";
}
function textFromParts(parts) {
	if (!Array.isArray(parts)) return "";
	let text = "";
	for (const part of parts) text += textFromPart(part);
	return text;
}
function messageText(message) {
	if (typeof message !== "object" || message === null) return "";
	const rec = message;
	if (typeof rec.content === "string") return rec.content;
	if (Array.isArray(rec.content)) return textFromParts(rec.content);
	const fromTopLevel = textFromParts(rec.parts);
	if (fromTopLevel.length > 0) return fromTopLevel;
	if (typeof rec.content !== "object" || rec.content === null) return "";
	const nested = rec.content;
	const fromNested = textFromParts(nested.parts);
	if (fromNested.length > 0) return fromNested;
	if (typeof nested.content === "string") return nested.content;
	return "";
}
function collectText(messages, roles) {
	const parts = [];
	for (const message of messages) {
		if (roles !== void 0) {
			const role = typeof message === "object" && message !== null ? message.role : void 0;
			if (typeof role === "string" && !roles.includes(role)) continue;
		}
		const text = messageText(message);
		if (text.length > 0) parts.push(text);
	}
	return parts.join("\n");
}
function idsFromMessages(messages) {
	for (const message of messages) {
		if (typeof message !== "object" || message === null) continue;
		const rec = message;
		const threadId = typeof rec.threadId === "string" ? rec.threadId : void 0;
		const resourceId = typeof rec.resourceId === "string" ? rec.resourceId : void 0;
		if (threadId !== void 0 || resourceId !== void 0) return {
			...threadId === void 0 ? {} : { threadId },
			...resourceId === void 0 ? {} : { resourceId }
		};
	}
	return {};
}
/**
* Call Mastra's `abort()` and, if a buggy implementation returns, still deny.
* Returning after a DENY would fail the turn open.
*/
function denyTurn(abort, reason, options) {
	abort(reason, options);
	throw new Error("@arcjet/guard: processor abort() returned; denying the turn");
}
function guardProcessor(client, policy) {
	const processorId = policy.id ?? "arcjet-guard";
	const processorName = policy.name ?? "Arcjet Guard";
	async function screen(messages, abort, requestContext, phase, extraText) {
		const fromMessages = collectText(messages, phase === "input" ? void 0 : ["assistant"]);
		const text = extraText !== void 0 && extraText.length > 0 ? [fromMessages, extraText].filter((part) => part.length > 0).join("\n") : fromMessages;
		const requestCtx = isRequestContextLike(requestContext) ? requestContext : void 0;
		const fromMessagesIds = idsFromMessages(messages);
		const agentCtx = mastraAgentContext({
			...requestCtx === void 0 ? {} : { requestContext: requestCtx },
			...fromMessagesIds.threadId === void 0 && fromMessagesIds.resourceId === void 0 ? {} : { agent: fromMessagesIds }
		});
		const input = {
			text,
			messages,
			...requestCtx === void 0 ? {} : { requestContext: requestCtx }
		};
		const rules = typeof policy.rules === "function" ? policy.rules(input) : policy.rules;
		const policyMetadata = typeof policy.metadata === "function" ? policy.metadata(input) : policy.metadata;
		const metadata = {
			...agentCtx.metadata,
			"mastra.phase": phase,
			...policyMetadata
		};
		await runGate(client, {
			action: policy.action,
			rules,
			correlationId: agentCtx.correlationId,
			metadata,
			onAllow: () => {},
			onDeny: (decision) => denyTurn(abort, deniedReason(decision), { retry: decision.reason === "RATE_LIMIT" }),
			onUnavailable: () => denyTurn(abort, unavailableReason()),
			onGuardError: policy.onGuardError ?? "deny"
		});
	}
	return {
		id: processorId,
		name: processorName,
		async processInput(args) {
			await screen(args.messages, args.abort, args.requestContext, "input");
			if (args.state !== void 0 && args.state !== null) args.state[inputScreened] = true;
			return args.messages;
		},
		async processInputStep(args) {
			const state = args.state === void 0 || args.state === null ? void 0 : args.state;
			if (args.stepNumber === 0 && state?.[inputScreened] === true) return args.messages;
			await screen(args.messages, args.abort, args.requestContext, "input");
			return args.messages;
		},
		async processOutputResult(args) {
			const extraText = typeof args.result?.text === "string" ? args.result.text : void 0;
			await screen(args.messages, args.abort, args.requestContext, "output", extraText);
			return args.messages;
		}
	};
}
//#endregion
export { guardProcessor };
