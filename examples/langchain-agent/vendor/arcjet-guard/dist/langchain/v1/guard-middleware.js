import { shouldWarn } from "../../agents/capture.js";
import { denialResult, unavailableResult } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { langchainContext } from "./context.js";
//#region src/langchain/v1/guard-middleware.ts
/**
* Well-known brand `createMiddleware` stamps on every instance. A raw
* function is not middleware; this symbol is what keeps a `{ name }`
* object from being mistaken for one.
*/
const MIDDLEWARE_BRAND = Symbol.for("AgentMiddleware");
let toolMessageCtor;
/**
* wrapToolCall's return is NOT passed through `baseHandler`. A bare
* object is the reducer-crash case. Construct a real `ToolMessage`
* from `@langchain/core/messages`.
*
* This is a dynamic import on purpose: a static value import would
* make the namespace unloadable when the optional peer is absent.
* Construction only runs on a deny / fail-closed path, which is
* only reachable in an app that already installed `langchain`.
*/
async function loadToolMessage() {
	if (toolMessageCtor !== void 0) return toolMessageCtor;
	const ctor = (await import("@langchain/core/messages")).ToolMessage;
	if (typeof ctor !== "function") throw new Error("@arcjet/guard: guardMiddleware() could not load ToolMessage from @langchain/core/messages; wrapToolCall cannot return a completed denial.");
	toolMessageCtor = ctor;
	return toolMessageCtor;
}
async function denialToolMessage(request, payload) {
	const ToolMessage = await loadToolMessage();
	const fields = {
		content: JSON.stringify(payload),
		tool_call_id: typeof request.toolCall.id === "string" ? request.toolCall.id : ""
	};
	if (request.toolCall.name.length > 0) fields.name = request.toolCall.name;
	return new ToolMessage(fields);
}
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
function isRecord(value) {
	return value !== null && typeof value === "object";
}
function isToolCallRequest(value) {
	if (!isRecord(value) || !isRecord(value["toolCall"])) return false;
	return typeof value["toolCall"]["name"] === "string";
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
function isBrandedTool(tool) {
	return tool !== null && typeof tool === "object" && arcjetProtectedTool in tool;
}
let middlewareSeq = 0;
/**
* A registry key, not a secret: `createAgent` composes middleware by
* name in error messages, and two distinct instances sharing one
* would be indistinguishable in those logs. The counter alone is not
* enough because a second copy of this module starts counting at one
* again.
*/
function middlewareName() {
	middlewareSeq += 1;
	return `arcjet-guard-${middlewareSeq}-${crypto.randomUUID().slice(0, 8)}`;
}
/**
* A `createAgent({ middleware })` middleware whose `wrapToolCall` is
* the invoke()-wide gate.
*
* MCP tools, runtime-discovered tools, and anything not wrapped with
* `guardTool` skip the authored handler. This is the Genkit
* `guardMiddleware` / LangGraph `guardToolNode` equivalent. Put it on
* `createAgent({ middleware: [guardMiddleware(...)] })`.
*
* `wrapToolCall` *can* deny: LangChain's official auth example returns
* a `ToolMessage` without calling `handler`. This helper does that.
* The return is validated with `ToolMessage.isInstance` and is **not**
* passed through `baseHandler`, so a bare object is the
* messages-reducer crash. This helper does **not** throw (throws
* bubble and drop `arcjetDenied`) and does **not** set
* `status: "error"` (the denial lives in `content`). Policy sits on
* `wrapToolCall` only — `afterModel` is where HITL already lives.
*
* Already-branded tools (`guardTool`) are skipped when
* `request.tool` can be looked up, so Guard is not double-called.
* Tools that cannot be looked up (`request.tool` undefined — MCP /
* unwrapped / runtime-discovered) are still gated.
*
* Correlation is read from `request.runtime.configurable.thread_id`
* (langchain >= 1.2.34). No id is minted.
*
* Server-side provider tools and headless `.implement()` tools are
* out of scope.
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardMiddleware } from "@arcjet/guard/langchain/v1";
*
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
* const mcpLimit = tokenBucket({
*   refillRate: 20,
*   intervalSeconds: 60,
*   maxTokens: 20,
* });
*
* const agent = createAgent({
*   model,
*   tools: [lookupOrder, ...mcpTools],
*   middleware: [
*     guardMiddleware(arcjet, {
*       action: ({ toolName }) => `${toolName}.invoked`,
*       rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
*       sessionId: conversationId,
*     }),
*   ],
* });
* ```
*/
function guardMiddleware(client, policy = {}) {
	const wrapToolCall = ((request, handler) => {
		if (!isToolCallRequest(request)) return handler(request);
		if (isBrandedTool(request.tool)) return handler(request);
		const toolName = request.toolCall.name;
		const call = {
			toolName,
			input: request.toolCall.args ?? {}
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
			if (policy.onGuardError === "allow") return handler(request);
			return denialToolMessage(request, unavailableResult());
		}
		const agentCtx = langchainContext(isContextSource(request.runtime) ? request.runtime : void 0, sessionId === void 0 ? void 0 : { sessionId });
		const mergedMetadata = {
			...agentCtx.metadata,
			...toolName.length > 0 && { "langchain.tool": toolName },
			...policyMetadata
		};
		return runGuarded(client, {
			action,
			rules,
			correlationId: agentCtx.correlationId,
			metadata: mergedMetadata,
			onDeny: (decision) => {
				if (policy.onDeny === void 0) return denialToolMessage(request, denialResult(decision));
				try {
					return denialToolMessage(request, policy.onDeny(decision));
				} catch (error) {
					if (shouldWarn()) console.warn("@arcjet/guard: onDeny for \"%s\" threw; returning the default denial:", action, error);
					return denialToolMessage(request, denialResult(decision));
				}
			},
			onUnavailable: () => denialToolMessage(request, unavailableResult()),
			execute: () => handler(request),
			onGuardError: policy.onGuardError ?? "deny"
		});
	});
	const middleware = {
		name: middlewareName(),
		wrapToolCall
	};
	Object.defineProperty(middleware, MIDDLEWARE_BRAND, {
		value: true,
		enumerable: false,
		configurable: true
	});
	return middleware;
}
//#endregion
export { guardMiddleware };
