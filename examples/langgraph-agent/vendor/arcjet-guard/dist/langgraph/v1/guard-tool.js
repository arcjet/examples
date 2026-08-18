import { shouldWarn } from "../../agents/capture.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { langgraphAgentContext } from "./context.js";
import { denialToolResult, unavailableToolResult } from "./denial.js";
//#region src/langgraph/v1/guard-tool.ts
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
function isToolCall(input) {
	return input !== null && typeof input === "object" && "type" in input && input.type === "tool_call" && "args" in input;
}
function toolArgs(input) {
	return isToolCall(input) ? input.args : input;
}
function toolCallId(input) {
	if (isToolCall(input) && typeof input.id === "string" && input.id.length > 0) return input.id;
}
/**
* Wraps a LangChain `tool()` / `StructuredTool` so `func` / `invoke` never
* runs on DENY.
*
* Always runs `guard()` before the tool, submitting `policy.rules` or none;
* on DENY the original function never executes and the model receives a
* tool result with `status: "error"` (or the result of `policy.onDeny`).
* This helper does not throw on DENY.
*
* Guard API errors depend on `policy.onGuardError` (defaults to `"deny"`):
* - `"deny"` (default): Tool does not execute; the model receives
*   `status: "error"` with `reason: "ERROR"`.
* - `"allow"`: Tool still runs, with a warning gated on `ARCJET_LOG_LEVEL`.
*
* Correlation is read from the invoke `config` / `ToolRuntime`
* (`configurable.thread_id`). No id is minted.
*
* Do not also wrap the same tool with `@arcjet/guard/vercel-ai/v7` or pass
* it through `guardToolNode` after wrapping — the shared
* `arcjetProtectedTool` brand throws on a second `guardTool` wrap.
* `guardToolNode` skips already-branded tools so Guard is not double-called.
*
* This is Graph API (`StateGraph` + `ToolNode`). `createReactAgent` is
* deprecated in LangGraph JS v1; do not build on it. LangChain
* `createAgent` / `wrapToolCall` is a later adapter.
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardTool } from "@arcjet/guard/langgraph/v1";
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
	const hasFunc = typeof tool.func === "function";
	const hasInvoke = typeof tool.invoke === "function";
	if (!hasFunc && !hasInvoke) throw new Error("@arcjet/guard: guardTool() requires a tool with a func or invoke function");
	if (arcjetProtectedTool in tool) throw new Error("@arcjet/guard: guardTool() cannot wrap a tool that is already guarded; do not double-wrap with @arcjet/guard/langgraph/v1 or @arcjet/guard/vercel-ai/v7");
	const func = tool.func;
	const invoke = tool.invoke;
	const originalFunc = hasFunc && func !== void 0 ? func.bind(tool) : void 0;
	const originalInvoke = hasInvoke && invoke !== void 0 ? invoke.bind(tool) : void 0;
	const proto = Object.getPrototypeOf(tool);
	const wrapped = Object.defineProperties(Object.create(proto), Object.getOwnPropertyDescriptors(tool));
	let inFlight = false;
	const run = async (input, config, execute) => {
		if (inFlight) return execute();
		inFlight = true;
		try {
			return await runGuardedTool(client, tool, policy, input, config, execute);
		} finally {
			inFlight = false;
		}
	};
	if (originalFunc !== void 0) {
		const newFunc = (input, runtime) => run(input, runtime, () => Promise.resolve(originalFunc(input, runtime)));
		Object.defineProperty(wrapped, "func", {
			value: newFunc,
			writable: true,
			enumerable: true,
			configurable: true
		});
	}
	if (originalInvoke !== void 0) {
		const newInvoke = (input, config) => run(input, config, () => Promise.resolve(originalInvoke(input, config)));
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
	const extras = { name: typeof tool.name === "string" ? tool.name : "" };
	const callId = toolCallId(input);
	if (callId !== void 0) extras.toolCallId = callId;
	let action;
	let rules;
	let policyMetadata;
	try {
		const typedArgs = args;
		action = typeof policy.action === "function" ? policy.action(typedArgs) : policy.action;
		rules = typeof policy.rules === "function" ? policy.rules(typedArgs) : policy.rules;
		policyMetadata = typeof policy.metadata === "function" ? policy.metadata(typedArgs) : policy.metadata;
	} catch (error) {
		const actionLabel = typeof policy.action === "string" ? policy.action : "tool.invoked";
		if (shouldWarn()) console.warn("@arcjet/guard: policy factory for \"%s\" threw; treating as a guard error:", actionLabel, error);
		if (policy.onGuardError === "allow") return execute();
		return Promise.resolve(unavailableToolResult(extras));
	}
	const agentCtx = langgraphAgentContext(isContextSource(config) ? config : void 0);
	const mergedMetadata = {
		...agentCtx.metadata,
		...typeof tool.name === "string" && tool.name.length > 0 && { "langgraph.tool": tool.name },
		...policyMetadata
	};
	return runGuarded(client, {
		action,
		rules,
		correlationId: agentCtx.correlationId,
		metadata: mergedMetadata,
		onDeny: (decision) => {
			const fallback = denialToolResult(decision, extras);
			if (policy.onDeny === void 0) return fallback;
			try {
				return policy.onDeny(decision);
			} catch (error) {
				if (shouldWarn()) console.warn("@arcjet/guard: onDeny for \"%s\" threw; returning the default denial:", action, error);
				return fallback;
			}
		},
		onUnavailable: () => unavailableToolResult(extras),
		execute,
		onGuardError: policy.onGuardError ?? "deny"
	});
}
//#endregion
export { guardTool };
