import { shouldWarn } from "../../agents/capture.js";
import { denialResult, unavailableResult } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { langchainContext } from "./context.js";
//#region src/langchain/v1/guard-tool.ts
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
function isToolCall(input) {
	return input !== null && typeof input === "object" && "type" in input && input.type === "tool_call" && "args" in input;
}
/**
* The model-produced arguments. `createAgent` invokes a tool with the
* whole `ToolCall`, so rules must see `args` rather than the envelope
* — scanning the envelope would feed an opaque `tool_call_id` to the
* detectors.
*/
function toolArgs(input) {
	return isToolCall(input) ? input.args : input;
}
function resolveSessionId(policy, input) {
	if (typeof policy.sessionId === "function") return policy.sessionId(input);
	if (typeof policy.sessionId === "string" && policy.sessionId.length > 0) return policy.sessionId;
}
/**
* Wraps a LangChain `tool()` / `StructuredTool` so `func` / `invoke`
* never runs on DENY.
*
* Always runs `guard()` before the tool. On DENY the original
* function never executes and the caller receives a plain
* `ArcjetDenialResult` (or the result of `policy.onDeny`). This
* helper does not throw on DENY and does not fabricate a
* `ToolMessage`. Through `createAgent`, the ToolNode `baseHandler`
* wraps a non-ToolMessage result in a real `ToolMessage` whose
* `status` is success — the denial lives in the payload. Same
* envelope as `@arcjet/guard/langgraph/v1`.
*
* Guard API errors depend on `policy.onGuardError` (defaults to `"deny"`):
* - `"deny"` (default): Tool does not execute; the model receives an
*   `ArcjetDenialResult` with `reason: "ERROR"`.
* - `"allow"`: Tool still runs, with a warning gated on
*   `ARCJET_LOG_LEVEL`.
*
* Correlation is read from the invoke `config` / `ToolRuntime`
* (`configurable.thread_id` as of langchain 1.2.34). No id is minted.
*
* Do not also wrap the same tool with `@arcjet/guard/langgraph/v1` or
* `@arcjet/guard/vercel-ai/v7`. The shared `arcjetProtectedTool` brand
* throws on a second `guardTool` wrap, and `guardMiddleware` skips
* already-branded tools so Guard is not double-called.
*
* This is LangChain `createAgent`, not Graph API `StateGraph` +
* `ToolNode`.
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardTool } from "@arcjet/guard/langchain/v1";
* import { tool } from "@langchain/core/tools";
* import { z } from "zod";
*
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
* const lookupLimit = tokenBucket({
*   refillRate: 10,
*   intervalSeconds: 60,
*   maxTokens: 10,
* });
*
* export const lookupOrder = guardTool(
*   arcjet,
*   tool(
*     async ({ orderNumber }) => ({ orderNumber, status: "shipped" }),
*     {
*       name: "lookup_order",
*       description: "Look up an order by number",
*       schema: z.object({ orderNumber: z.string() }),
*     },
*   ),
*   {
*     action: "order.looked-up",
*     rules: (input) => [lookupLimit({ key: input.orderNumber, requested: 1 })],
*   },
* );
* ```
*/
function guardTool(client, tool, policy) {
	const func = typeof tool.func === "function" ? tool.func : void 0;
	const invoke = typeof tool.invoke === "function" ? tool.invoke : void 0;
	if (func === void 0 && invoke === void 0) throw new Error("@arcjet/guard: guardTool() requires a tool with a func or invoke function");
	if (arcjetProtectedTool in tool) throw new Error("@arcjet/guard: guardTool() cannot wrap a tool that is already guarded; do not double-wrap with @arcjet/guard/langchain/v1, @arcjet/guard/langgraph/v1, or @arcjet/guard/vercel-ai/v7");
	const originalFunc = func?.bind(tool);
	const originalInvoke = invoke?.bind(tool);
	const proto = Object.getPrototypeOf(tool);
	const wrapped = Object.defineProperties(Object.create(proto), Object.getOwnPropertyDescriptors(tool));
	if (originalFunc !== void 0) {
		const newFunc = (input, runtime) => runGuardedTool(client, tool, policy, input, runtime, () => Promise.resolve(originalFunc(input, runtime)));
		Object.defineProperty(wrapped, "func", {
			value: newFunc,
			writable: true,
			enumerable: true,
			configurable: true
		});
	}
	if (originalInvoke !== void 0) {
		const newInvoke = (input, config) => runGuardedTool(client, tool, policy, input, config, () => Promise.resolve(originalInvoke(input, config)));
		Object.defineProperty(wrapped, "invoke", {
			value: newInvoke,
			writable: true,
			enumerable: true,
			configurable: true
		});
	}
	Object.defineProperty(wrapped, arcjetProtectedTool, {
		value: true,
		enumerable: false,
		configurable: true
	});
	return wrapped;
}
function runGuardedTool(client, tool, policy, input, config, execute) {
	const args = toolArgs(input);
	let action;
	let sessionId;
	let rules;
	let policyMetadata;
	try {
		const typedArgs = args;
		action = typeof policy.action === "function" ? policy.action(typedArgs) : policy.action;
		sessionId = resolveSessionId(policy, typedArgs);
		rules = typeof policy.rules === "function" ? policy.rules(typedArgs) : policy.rules;
		policyMetadata = typeof policy.metadata === "function" ? policy.metadata(typedArgs) : policy.metadata;
	} catch (error) {
		const actionLabel = typeof policy.action === "string" ? policy.action : "tool.invoked";
		if (shouldWarn()) console.warn("@arcjet/guard: policy factory for \"%s\" threw; treating as a guard error:", actionLabel, error);
		if (policy.onGuardError === "allow") return execute();
		return Promise.resolve(unavailableResult());
	}
	const source = isContextSource(config) ? config : void 0;
	const agentCtx = langchainContext(source, sessionId === void 0 ? void 0 : { sessionId });
	const mergedMetadata = {
		...agentCtx.metadata,
		...typeof tool.name === "string" && tool.name.length > 0 && { "langchain.tool": tool.name },
		...policyMetadata
	};
	return runGuarded(client, {
		action,
		rules,
		correlationId: agentCtx.correlationId,
		metadata: mergedMetadata,
		onDeny: (decision) => {
			if (policy.onDeny === void 0) return denialResult(decision);
			try {
				return policy.onDeny(decision);
			} catch (error) {
				if (shouldWarn()) console.warn("@arcjet/guard: onDeny for \"%s\" threw; returning the default denial:", action, error);
				return denialResult(decision);
			}
		},
		onUnavailable: () => unavailableResult(),
		execute,
		onGuardError: policy.onGuardError ?? "deny"
	});
}
//#endregion
export { guardTool };
