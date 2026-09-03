import { shouldWarn } from "../../agents/capture.js";
import { denialResult, unavailableResult } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
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
function isBrandedTool(tool) {
	return tool !== null && typeof tool === "object" && arcjetProtectedTool in tool;
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
function gateToolCall(client, policy, ctx) {
	const brandedCandidate = Object.getOwnPropertyDescriptor(ctx, "tool")?.value;
	if (isBrandedTool(brandedCandidate)) return Promise.resolve();
	const toolName = ctx.toolName;
	const call = {
		toolName,
		input: ctx.input ?? {}
	};
	let action;
	let sessionId;
	let rules;
	let policyMetadata;
	try {
		action = resolveAction(policy, call);
		sessionId = resolveSessionId(policy, call);
		rules = typeof policy.rules === "function" ? policy.rules(call) : policy.rules;
		policyMetadata = typeof policy.metadata === "function" ? policy.metadata(call) : policy.metadata;
	} catch (error) {
		const actionLabel = typeof policy.action === "string" ? policy.action : "tool.invoked";
		if (shouldWarn()) console.warn("@arcjet/guard: policy factory for \"%s\" threw; treating as a guard error:", actionLabel, error);
		if (policy.onGuardError === "allow") return Promise.resolve();
		return Promise.resolve(denyDecision(policy, unavailableResult(), "unavailable"));
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
		onDeny: (decision) => denyDecision(policy, denialResult(decision), "deny"),
		onUnavailable: () => denyDecision(policy, unavailableResult(), "unavailable"),
		execute: () => Promise.resolve(),
		onGuardError: policy.onGuardError ?? "deny"
	});
}
/**
* Think `beforeToolCall` hooks that gate tool execution before
* `execute` runs.
*
* Delegate from a `Think` subclass:
*
* ```ts
* const hooks = guardHooks(arcjet, { sessionId: conversationId });
* export class SupportAgent extends Think<Env> {
*   beforeToolCall(ctx) {
*     return hooks.beforeToolCall(ctx);
*   }
* }
* ```
*
* Default DENY is `{ action: "substitute", output: ArcjetDenialResult }`
* so the tool never runs and the model sees the payload. Optional
* `onDeny: "block"` returns `{ action: "block", reason }` (the denial
* `message` string). `onDeny: "block"` applies to real DENY only;
* unavailable stays substitute. This helper does **not** throw from
* the hook.
*
* On Guard error this helper fail-closes: it ALWAYS returns
* `block` / `substitute`, never void / `{ action: "allow" }` (unless
* `onGuardError: "allow"`). Core `protect()` / `guard()` stay
* fail-open.
*
* Think starter `needsApproval` is HITL, not a policy gate. After a
* human yes, Guard still runs. Client tools and tools with no local
* `execute` are out of scope — Think does not fire `beforeToolCall`
* for those.
*
* Already-branded tools (`arcjetProtectedTool` from a sibling
* `guardTool`) are skipped so Guard is not double-called. This
* namespace has no `guardTool`, and inbound `guard()` before `chat()`
* does not stamp that brand — it is a separate call and tools are
* still gated.
*
* Think re-wraps `execute` on the Cloudflare Agents harness (Durable
* Objects, workspace / MCP / client tools). Do **not** also wrap the
* same tools with `@arcjet/guard/vercel-ai/v7`. Mixing the two
* wrappers on one tool is disallowed.
*
* On ALLOW this helper captures `outcome: "success"` when the
* policy lets the tool run, not when `execute` finishes.
* `beforeToolCall` cannot wrap the tool; a later tool throw does
* not flip that capture.
*
* There is no `guardTool`. Skip is the hook return, not
* throw-from-execute. There is no `guardInbound` and no
* `guardApproval`.
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
*   beforeToolCall(ctx) {
*     return hooks.beforeToolCall(ctx);
*   }
* }
* ```
*/
function guardHooks(client, policy = {}) {
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
