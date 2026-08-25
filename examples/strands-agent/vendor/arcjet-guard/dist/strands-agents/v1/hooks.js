import { captureEvent, shouldWarn } from "../../agents/capture.js";
import { denialResult, unavailableResult } from "../../agents/denial.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { strandsAgentContext } from "./context.js";
import { runGate } from "./gate.js";
//#region src/strands-agents/v1/hooks.ts
let loadedSdk;
/**
* `addHook` keys the registry by constructor identity, so the Plugin
* must pass the real `BeforeToolCallEvent` / `AfterToolCallEvent`
* classes. A static value import would make the namespace unloadable
* when the optional peer is absent. Loading only inside `initAgent`
* (which an app reaches only after constructing an Agent) keeps
* `import { guardTool } from "@arcjet/guard/strands-agents/v1"`
* peer-free. Same reason LangChain dynamically loads `ToolMessage`.
*/
async function loadStrandsHooks() {
	if (loadedSdk !== void 0) return loadedSdk;
	let sdk;
	try {
		sdk = await import("@strands-agents/sdk");
	} catch (error) {
		if ((error !== null && typeof error === "object" && "code" in error ? error.code : void 0) === "ERR_MODULE_NOT_FOUND") throw new Error("@arcjet/guard: install @strands-agents/sdk (>=1.1.0 <2) to use guardHooks() from @arcjet/guard/strands-agents/v1", { cause: error });
		throw error;
	}
	const before = sdk.BeforeToolCallEvent;
	const after = sdk.AfterToolCallEvent;
	const hookOrder = sdk.HookOrder;
	if (typeof before !== "function" || typeof after !== "function") throw new Error("@arcjet/guard: guardHooks() could not load BeforeToolCallEvent / AfterToolCallEvent from @strands-agents/sdk; the Plugin cannot register.");
	if (hookOrder === null || typeof hookOrder !== "object" || typeof hookOrder.SDK_FIRST !== "number") throw new Error("@arcjet/guard: guardHooks() could not load HookOrder from @strands-agents/sdk; the Plugin cannot register.");
	loadedSdk = {
		BeforeToolCallEvent: before,
		AfterToolCallEvent: after,
		HookOrder: hookOrder
	};
	return loadedSdk;
}
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
function stringField(value) {
	return typeof value === "string" ? value : "";
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
function cancelString(payload) {
	try {
		return JSON.stringify(payload);
	} catch (error) {
		if (shouldWarn()) console.warn("@arcjet/guard: guardHooks() could not JSON.stringify a denial payload; using the default denial:", error);
		return JSON.stringify(unavailableResult());
	}
}
let pluginSeq = 0;
/**
* A registry key, not a secret: PluginRegistry rejects a second plugin
* of the same name. The per-process counter helps debugging; cross-copy
* uniqueness comes from the random UUID suffix (a second bundle of this
* module resets the counter to 1).
*/
function pluginName() {
	pluginSeq += 1;
	return `arcjet-guard-${pluginSeq}-${crypto.randomUUID().slice(0, 8)}`;
}
/**
* The `BeforeToolCallEvent` handler. Exported for src tests so the
* deny / allow / brand-skip path can run without loading the peer
* (the Plugin's `initAgent` is the only place that value-imports).
*/
function createBeforeToolCallHandler(client, policy = {}) {
	return async (event) => {
		try {
			if (event.tool !== void 0 && arcjetProtectedTool in event.tool) return;
			const call = {
				toolName: stringField(event.toolUse?.name),
				input: event.toolUse?.input ?? {}
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
				if (policy.onGuardError === "allow") return;
				event.cancel = cancelString(unavailableResult());
				return;
			}
			const source = isContextSource(event) ? event : void 0;
			const agentCtx = strandsAgentContext(source, sessionId === void 0 ? void 0 : { sessionId });
			const mergedMetadata = {
				...agentCtx.metadata,
				"strands.phase": "before",
				...call.toolName.length > 0 && { "strands.tool": call.toolName },
				...policyMetadata
			};
			await runGate(client, {
				action,
				rules,
				correlationId: agentCtx.correlationId,
				metadata: mergedMetadata,
				onAllow: () => {},
				onDeny: (decision) => {
					if (policy.onDeny === void 0) {
						event.cancel = cancelString(denialResult(decision));
						return;
					}
					try {
						event.cancel = cancelString(policy.onDeny(decision));
					} catch (error) {
						if (shouldWarn()) console.warn("@arcjet/guard: onDeny for \"%s\" threw; returning the default denial:", action, error);
						event.cancel = cancelString(denialResult(decision));
					}
				},
				onUnavailable: () => {
					event.cancel = cancelString(unavailableResult());
				},
				onGuardError: policy.onGuardError ?? "deny"
			});
		} catch (error) {
			if (shouldWarn()) console.warn("@arcjet/guard: guardHooks BeforeToolCallEvent threw; denying the tool:", error);
			if (policy.onGuardError === "allow") return;
			event.cancel = cancelString(unavailableResult());
		}
	};
}
/**
* The `AfterToolCallEvent` handler. Capture only; never sets cancel
* and never throws.
*/
function createAfterToolCallHandler(client, policy = {}) {
	return (event) => {
		try {
			const call = {
				toolName: stringField(event.toolUse?.name),
				input: event.toolUse?.input ?? {}
			};
			const action = resolveAction(policy, call);
			const source = isContextSource(event) ? event : void 0;
			const agentCtx = strandsAgentContext(source);
			const policyMetadata = typeof policy.metadata === "function" ? policy.metadata(call) : policy.metadata;
			const metadata = {
				...agentCtx.metadata,
				...policyMetadata,
				"strands.phase": "after",
				...call.toolName.length > 0 && { "strands.tool": call.toolName },
				outcome: event.error === void 0 ? "success" : "error"
			};
			const correlation = agentCtx.correlationId === void 0 ? {} : { correlationId: agentCtx.correlationId };
			captureEvent(client, {
				action,
				...correlation,
				metadata
			});
		} catch {}
	};
}
/**
* A Plugin registered on `new Agent({ plugins })`.
*
* `initAgent` calls `agent.addHook(BeforeToolCallEvent, …, { order:
* HookOrder.SDK_FIRST - 1 })` so this gate runs before the SDK's own
* earliest hooks. On DENY it sets `event.cancel` to
* `JSON.stringify(ArcjetDenialResult)`. `tool.stream()` does not run;
* `AfterToolCallEvent` still fires.
*
* Already-branded (`guardTool`) tools are skipped so Guard is not
* double-called. Tools that are not branded — MCP, vended tools,
* anything not wrapped — are still gated.
*
* Do **not** use `BeforeToolsEvent.cancel` (that skips per-tool hooks).
* Do **not** call `event.interrupt()` (that is HITL).
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardHooks } from "@arcjet/guard/strands-agents/v1";
* import { Agent } from "@strands-agents/sdk";
*
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
* const mcpLimit = tokenBucket({
*   refillRate: 20,
*   intervalSeconds: 60,
*   maxTokens: 20,
* });
*
* const agent = new Agent({
*   tools: [lookupOrder],
*   plugins: [
*     guardHooks(arcjet, {
*       action: ({ toolName }) => `${toolName}.invoked`,
*       rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
*       sessionId: conversationId,
*     }),
*   ],
* });
* ```
*/
function guardHooks(client, policy = {}) {
	const onBefore = createBeforeToolCallHandler(client, policy);
	const onAfter = createAfterToolCallHandler(client, policy);
	return {
		name: pluginName(),
		initAgent: async (agent) => {
			const sdk = await loadStrandsHooks();
			agent.addHook(sdk.BeforeToolCallEvent, onBefore, { order: sdk.HookOrder.SDK_FIRST - 1 });
			agent.addHook(sdk.AfterToolCallEvent, onAfter);
		}
	};
}
//#endregion
export { createAfterToolCallHandler, createBeforeToolCallHandler, guardHooks };
