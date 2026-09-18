import { assertValidAction } from "../../agents/label.js";
import { resolveActorInputs } from "../../agents/actor-inputs.js";
import { shouldWarn } from "../../agents/capture.js";
import { denialResult, unavailableResult } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { cloudflareThinkContext } from "./context.js";
//#region src/cloudflare-think/v0/hooks.ts
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
function isRecord(value) {
	return value !== null && typeof value === "object";
}
function isToolCallContext(value) {
	if (!isRecord(value)) return false;
	return typeof value["toolName"] === "string";
}
function resolveAction(policy, call) {
	if (typeof policy.action === "function") return policy.action(call);
	if (typeof policy.action === "string" && policy.action.length > 0) return policy.action;
	return "tool.invoked";
}
function resolveSessionId(policy, call) {
	if (typeof policy.sessionId === "function") return policy.sessionId(call);
	if (typeof policy.sessionId === "string" && policy.sessionId.length > 0) return policy.sessionId;
}
function denyDecision(policy, payload, kind) {
	if (kind === "deny" && policy.onDeny === "block") return {
		action: "block",
		reason: payload.message
	};
	return {
		action: "substitute",
		output: payload
	};
}
async function gateToolCall(client, policy, ctx) {
	const toolName = ctx.toolName;
	const call = {
		toolName,
		input: ctx.input ?? {}
	};
	let action;
	let sessionId;
	let rules;
	let policyMetadata;
	let remote = {};
	try {
		action = resolveAction(policy, call);
		sessionId = resolveSessionId(policy, call);
		rules = typeof policy.rules === "function" ? policy.rules(call) : policy.rules;
		policyMetadata = typeof policy.metadata === "function" ? policy.metadata(call) : policy.metadata;
		remote = await resolveActorInputs(policy, call, ctx);
	} catch (error) {
		const actionLabel = typeof policy.action === "string" ? policy.action : "tool.invoked";
		if (shouldWarn()) console.warn("@arcjet/guard: policy factory for \"%s\" threw; treating as a guard error:", actionLabel, error);
		if (policy.onGuardError === "allow") return;
		return denyDecision(policy, unavailableResult(), "unavailable");
	}
	const source = isContextSource(ctx) ? ctx : void 0;
	const agentCtx = cloudflareThinkContext(source, sessionId === void 0 ? void 0 : { sessionId });
	const mergedMetadata = {
		...agentCtx.metadata,
		...toolName.length > 0 && { "cloudflare-think.tool": toolName },
		...policyMetadata
	};
	return runGuarded(client, {
		action,
		rules,
		correlationId: agentCtx.correlationId,
		metadata: mergedMetadata,
		...remote,
		onDeny: (decision) => denyDecision(policy, denialResult(decision), "deny"),
		onUnavailable: () => denyDecision(policy, unavailableResult(), "unavailable"),
		execute: () => Promise.resolve(),
		onGuardError: policy.onGuardError ?? "deny"
	});
}
/**
* A Think `beforeToolCall` hook object that is the tool-call gate.
*
* Assign `hooks.beforeToolCall` on a `Think` subclass. Think wraps
* every server-side tool's `execute` so this hook runs first. Client
* tools are out of scope — Think cannot intercept them.
*
* Default DENY is `{ action: "substitute", output: ArcjetDenialResult }`
* so the tool never runs and the model sees the payload. Optional
* `onDeny: "block"` returns `{ action: "block", reason }` (the denial
* `message` string) and skips the tool — the model does not get
* `ArcjetDenialResult`. Block does **not** hand the model
* `ArcjetDenialResult` — prefer default substitute when it should.
* `onDeny: "block"` applies to real DENY only; unavailable stays
* substitute. This helper does **not** throw from the hook (a throw
* from Think's `beforeToolCall` is a hook error, not a policy denial).
*
* On ALLOW this helper captures `outcome: "success"` when the
* policy lets the tool run, not when `execute` finishes.
* `beforeToolCall` cannot wrap the tool; a later tool throw does
* not flip that capture.
*
* There is no `guardTool`. There is no `afterToolCall` capture
* hook — `beforeToolCall` is the gate. Do not mix with
* `@arcjet/guard/vercel-ai/v7`. Think is not the Vercel AI SDK.
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardHooks } from "@arcjet/guard/cloudflare-think/v0";
* import { Think } from "@cloudflare/think";
*
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
* const mcpLimit = tokenBucket({
*   refillRate: 20,
*   intervalSeconds: 60,
*   maxTokens: 20,
* });
*
* const hooks = guardHooks(arcjet, {
*   action: ({ toolName }) => `${toolName}.invoked`,
*   rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
*   sessionId: conversationId,
* });
*
* export class SupportAgent extends Think<Env> {
*   override beforeToolCall = hooks.beforeToolCall;
* }
* ```
*/
function guardHooks(client, policy = {}) {
	if (typeof policy.action === "string" && policy.action !== "") assertValidAction(policy.action, "guardHooks");
	const beforeToolCall = async (ctx) => {
		try {
			if (!isToolCallContext(ctx)) return;
			return await gateToolCall(client, policy, ctx);
		} catch (error) {
			if (shouldWarn()) console.warn("@arcjet/guard: beforeToolCall for a Cloudflare Think tool threw; treating as a guard error:", error);
			if (policy.onGuardError === "allow") return;
			return denyDecision(policy, unavailableResult(), "unavailable");
		}
	};
	return { beforeToolCall };
}
//#endregion
export { guardHooks };
