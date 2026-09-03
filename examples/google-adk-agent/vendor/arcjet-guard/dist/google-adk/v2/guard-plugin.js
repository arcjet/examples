import { shouldWarn } from "../../agents/capture.js";
import { denialResult, unavailableResult } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { googleAdkContext } from "./context.js";
//#region src/google-adk/v2/guard-plugin.ts
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
function isRecord(value) {
	return value !== null && typeof value === "object";
}
function isBeforeToolParams(value) {
	if (!isRecord(value)) return false;
	const tool = value["tool"];
	return isRecord(tool) && typeof tool["name"] === "string";
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
function denyDict(payload) {
	return payload;
}
let pluginSeq = 0;
/**
* A registry key, not a secret: `PluginManager` rejects two plugins
* that share a name, and two distinct instances sharing one would
* fail to register. The counter alone is not enough because a second
* copy of this module starts counting at one again.
*/
function pluginName() {
	pluginSeq += 1;
	return `arcjet-guard-${pluginSeq}-${crypto.randomUUID().slice(0, 8)}`;
}
function gateToolCall(client, policy, params) {
	if (isBrandedTool(params.tool)) return Promise.resolve(void 0);
	const toolName = params.tool.name;
	const call = {
		toolName,
		input: params.toolArgs ?? {}
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
		if (policy.onGuardError === "allow") return Promise.resolve(void 0);
		return Promise.resolve(denyDict(unavailableResult()));
	}
	const source = isContextSource(params.toolContext) ? params.toolContext : void 0;
	const agentCtx = googleAdkContext(source, sessionId === void 0 ? void 0 : { sessionId });
	const mergedMetadata = {
		...agentCtx.metadata,
		...toolName.length > 0 && { "google-adk.tool": toolName },
		...policyMetadata
	};
	return runGuarded(client, {
		action,
		rules,
		correlationId: agentCtx.correlationId,
		metadata: mergedMetadata,
		onDeny: (decision) => denyDict(denialResult(decision)),
		onUnavailable: () => denyDict(unavailableResult()),
		execute: () => Promise.resolve(void 0),
		onGuardError: policy.onGuardError ?? "deny"
	});
}
function noopUndefined() {
	return Promise.resolve(void 0);
}
function noopVoid() {
	return Promise.resolve();
}
/**
* Structural `BasePlugin` with every PluginManager callback present.
*
* PluginManager calls methods by name on every plugin for every
* lifecycle event. A missing method throws, and a throw from a
* plugin is re-raised as a plugin error — a different path than
* skip. No-op stubs return `undefined` so later plugins still run
* for those events. Only `beforeToolCallback` is the policy gate.
* Closures, not instance fields, so extracting the callback still
* fail-closes.
*/
function createGuardPlugin(client, policy) {
	const beforeToolCallback = async (params) => {
		try {
			if (!isBeforeToolParams(params)) return;
			return await gateToolCall(client, policy, params);
		} catch (error) {
			if (shouldWarn()) console.warn("@arcjet/guard: beforeToolCallback for a Google ADK tool threw; treating as a guard error:", error);
			if (policy.onGuardError === "allow") return;
			return denyDict(unavailableResult());
		}
	};
	return {
		name: pluginName(),
		beforeToolCallback,
		onUserMessageCallback: noopUndefined,
		beforeRunCallback: noopUndefined,
		onEventCallback: noopUndefined,
		afterRunCallback: noopVoid,
		beforeAgentCallback: noopUndefined,
		afterAgentCallback: noopUndefined,
		beforeNodeCallback: noopUndefined,
		afterNodeCallback: noopUndefined,
		beforeModelCallback: noopUndefined,
		afterModelCallback: noopUndefined,
		onModelErrorCallback: noopUndefined,
		beforeToolSelection: noopUndefined,
		beforeContextCompaction: noopVoid,
		afterContextCompaction: noopVoid,
		afterToolCallback: noopUndefined,
		onToolErrorCallback: noopUndefined
	};
}
/**
* A Runner `BasePlugin` whose `beforeToolCallback` is the tool-call
* gate.
*
* Put Arcjet **first** in `new Runner({ plugins })`. PluginManager
* is first-win: the first plugin that returns a non-`undefined`
* value short-circuits remaining plugins and agent callbacks. If
* another plugin (including `SecurityPlugin`) returns first, Guard
* never runs.
*
* DENY is a dictionary (`ArcjetDenialResult`). ADK treats a returned
* dict as skip: `runAsync` does not run and the model sees the
* payload. `undefined` lets the tool execute. This helper does
* **not** throw from the callback — PluginManager wraps a throw as a
* plugin error, which is a different path than skip.
*
* On Guard error this helper fail-closes: it ALWAYS returns a deny
* dict, never `undefined` (unless `onGuardError: "allow"`). Core
* `protect()` / `guard()` stay fail-open.
*
* Do not use ADK `SecurityPlugin` as the Arcjet policy gate.
* `requireConfirmation` / `requestConfirmation` is HITL. After a
* human yes, Guard still runs.
*
* Already-branded tools (`arcjetProtectedTool` from a sibling
* `guardTool`) are skipped so Guard is not double-called. This
* namespace has no `guardTool`, and inbound `guard()` before
* `Runner.runAsync` does not stamp that brand — it is a separate
* call and tools are still gated. The plugin does not implement an
* inbound / before-model prompt gate (`onUserMessageCallback` and
* `beforeModelCallback` are no-ops) so a preceding `guard()` does
* not double-call. Tools that are not branded — including when
* `params.tool` is unbranded — are still gated.
*
* On ALLOW this helper captures `outcome: "success"` when the
* policy lets the tool run, not when `runAsync` finishes.
* `beforeToolCallback` cannot wrap the tool; a later tool throw
* does not flip that capture.
*
* There is no `guardTool`. Skip is the plugin return, not
* throw-from-execute. There is no `guardInbound` and no
* `guardApproval`: `onUserMessageCallback` replaces the user
* message, `beforeRunCallback` / `beforeModelCallback` return
* `Content` / `LlmResponse` rather than a deny dict, and
* confirmation is HITL. Tool gate is enough for v2.
*
* Do not double-wrap with `@arcjet/guard/vercel-ai/v7`. This is
* Google ADK JS (`@google/adk` 2.x), not `@google/genai` and not
* Python google-adk.
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardPlugin } from "@arcjet/guard/google-adk/v2";
* import { Runner } from "@google/adk";
*
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
* const mcpLimit = tokenBucket({
*   refillRate: 20,
*   intervalSeconds: 60,
*   maxTokens: 20,
* });
*
* const runner = new Runner({
*   appName: "my_app",
*   agent,
*   sessionService,
*   plugins: [
*     guardPlugin(arcjet, {
*       action: ({ toolName }) => `${toolName}.invoked`,
*       rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
*       sessionId: conversationId,
*     }),
*   ],
* });
* ```
*/
function guardPlugin(client, policy = {}) {
	return createGuardPlugin(client, policy);
}
//#endregion
export { guardPlugin };
