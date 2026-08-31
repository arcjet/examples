import { shouldWarn } from "../../agents/capture.js";
import { denialResult, unavailableResult } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { tanstackAiContext } from "./context.js";
//#region src/tanstack-ai/v0/guard-middleware.ts
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
function isRecord(value) {
	return value !== null && typeof value === "object";
}
function isToolCallHookContext(value) {
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
	if (kind === "deny" && policy.onDeny === "abort") return {
		type: "abort",
		reason: payload.message
	};
	return {
		type: "skip",
		result: payload
	};
}
let middlewareSeq = 0;
/**
* A registry key, not a secret: `chat({ middleware })` composes
* middleware by name in logs, and two distinct instances sharing one
* would be indistinguishable. The counter alone is not enough because
* a second copy of this module starts counting at one again.
*/
function middlewareName() {
	middlewareSeq += 1;
	return `arcjet-guard-${middlewareSeq}-${crypto.randomUUID().slice(0, 8)}`;
}
function gateToolCall(client, policy, ctx, hookCtx) {
	if (isBrandedTool(hookCtx.tool)) return Promise.resolve();
	const toolName = hookCtx.toolName;
	const call = {
		toolName,
		input: hookCtx.args ?? {}
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
	const agentCtx = tanstackAiContext(source, sessionId === void 0 ? void 0 : { sessionId });
	const mergedMetadata = {
		...agentCtx.metadata,
		...toolName.length > 0 && { "tanstack-ai.tool": toolName },
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
* A `chat({ middleware })` middleware whose `onBeforeToolCall` is the
* tool-call gate.
*
* Put Arcjet **first** in the middleware array. `onBeforeToolCall` is
* first-win: the first middleware that returns a non-void decision
* wins, and the rest are skipped. If `toolCacheMiddleware` (or
* anything else) skips first, Guard never runs.
*
* Default DENY is `{ type: "skip", result: ArcjetDenialResult }` so
* the tool never runs and the model sees the payload. Optional
* `onDeny: "abort"` returns `{ type: "abort", reason }` and stops the
* chat run. This helper does **not** throw from the hook (TanStack
* swallows a throw from `execute` into `{ error }`, and a throw from
* this hook would abort the run as an error rather than a policy
* denial).
*
* Already-branded tools (`arcjetProtectedTool` from a preceding
* `guard()` wrap) are skipped so Guard is not double-called. Tools
* that are not branded — including when `hookCtx.tool` is undefined —
* are still gated.
*
* There is no `guardTool`. Throwing from `execute` is swallowed into
* `{ error }` and is not a usable deny envelope.
*
* Client tools and provider-native tools with no local `execute` are
* out of scope. Do not double-wrap with `@arcjet/guard/vercel-ai/v7`.
* TanStack AI is not the Vercel AI SDK.
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardMiddleware } from "@arcjet/guard/tanstack-ai/v0";
*
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
* const mcpLimit = tokenBucket({
*   refillRate: 20,
*   intervalSeconds: 60,
*   maxTokens: 20,
* });
*
* const stream = chat({
*   adapter,
*   messages,
*   tools: [lookupOrder, ...mcpTools],
*   context: { sessionId: conversationId },
*   middleware: [
*     guardMiddleware(arcjet, {
*       action: ({ toolName }) => `${toolName}.invoked`,
*       rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
*       sessionId: conversationId,
*     }),
*     toolCacheMiddleware(),
*   ],
* });
* ```
*/
function guardMiddleware(client, policy = {}) {
	const onBeforeToolCall = async (ctx, hookCtx) => {
		try {
			if (!isToolCallHookContext(hookCtx)) return;
			return await gateToolCall(client, policy, ctx, hookCtx);
		} catch (error) {
			if (shouldWarn()) console.warn("@arcjet/guard: onBeforeToolCall for a TanStack AI tool threw; failing closed:", error);
			if (policy.onGuardError === "allow") return;
			return denyDecision(policy, unavailableResult(), "unavailable");
		}
	};
	return {
		name: middlewareName(),
		onBeforeToolCall
	};
}
//#endregion
export { guardMiddleware };
