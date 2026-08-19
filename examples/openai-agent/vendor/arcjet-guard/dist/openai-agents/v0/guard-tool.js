import { shouldWarn } from "../../agents/capture.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { openaiAgentsContext } from "./context.js";
import { denialResult, unavailableResult } from "./denial.js";
//#region src/openai-agents/v0/guard-tool.ts
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
/**
* The model-produced arguments. The runner invokes with
* `toolCall.arguments` (a JSON string). Scan the parsed args, not
* `details.toolCall.callId`.
*
* Every tool from `tool()` has an object parameter schema — `tool()` rejects
* `parameters: undefined` at construction even though the type admits it — so
* a parse failure means malformed model output, not a free-text tool whose
* arguments were dropped. Rules see `{}` for it, and the original `invoke`
* then raises the SDK's own invalid-input failure. Anything that is neither a
* string nor an object cannot come from the runner at all, so it warns.
*/
function toolArgs(input, action) {
	if (typeof input === "string") try {
		return JSON.parse(input);
	} catch {
		return {};
	}
	if (input !== null && typeof input === "object") return input;
	if (shouldWarn()) console.warn("@arcjet/guard: guardTool() for \"%s\" was invoked with a %s input; expected the JSON string the runner passes, so no arguments were scanned.", action, input === null ? "null" : typeof input);
	return {};
}
function resolveSessionId(policy, input) {
	if (typeof policy.sessionId === "function") return policy.sessionId(input);
	if (typeof policy.sessionId === "string" && policy.sessionId.length > 0) return policy.sessionId;
}
/**
* Wraps a `tool()` / `FunctionTool` so the closed-over `execute` never
* runs on DENY.
*
* After `tool({ execute })` the runner calls `invoke`, not `execute`.
* This helper replaces `invoke` (via `Object.defineProperty`, so a
* non-writable descriptor still gets the wrap) and always runs `guard()`
* before the original `invoke`. On DENY the original `invoke` — and
* therefore `execute` — never runs. The model receives an
* `ArcjetDenialResult` (or the result of `policy.onDeny`). This helper
* does not throw on DENY: a throw would hit the SDK `errorFunction`
* (generic string, or `ToolCallError` when `outputSchema` /
* `errorFunction: null`).
*
* Guard API errors depend on `policy.onGuardError` (defaults to `"deny"`):
* - `"deny"` (default): `execute` does not run; the model receives an
*   `ArcjetDenialResult` with `reason: "ERROR"`.
* - `"allow"`: `execute` still runs, with a warning gated on
*   `ARCJET_LOG_LEVEL`.
*
* Correlation is read from `runContext.context` (and documented copies
* on the envelope). No id is minted. `session.getSessionId()` is never
* called.
*
* The runner treats whatever this returns as the tool's output, so two
* per-tool options see a denial as they would any other result: a
* `timeoutMs` race covers the guard round trip as well as `execute`, and
* `outputGuardrails` / `customDataExtractor` receive the denial object.
* Keep `timeoutMs` wide enough for a guard call, and do not assume your own
* output shape in those callbacks.
*
* Hosted tools, MCP (`mcpToFunctionTool`), handoffs, `agent.asTool()`,
* and computer / shell / apply_patch are not on this path. Do not also
* wrap the same tool with `@arcjet/guard/vercel-ai/v7`. The shared
* `arcjetProtectedTool` brand throws on a second `guardTool` wrap.
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardTool } from "@arcjet/guard/openai-agents/v0";
* import { tool } from "@openai/agents";
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
*   tool({
*     name: "lookup_order",
*     description: "Look up an order by number",
*     parameters: z.object({ orderNumber: z.string() }),
*     execute: async ({ orderNumber }) => ({ orderNumber, status: "shipped" }),
*   }),
*   {
*     action: "order.looked-up",
*     rules: (input: { orderNumber: string }) => [
*       lookupLimit({ key: input.orderNumber, requested: 1 }),
*     ],
*   },
* );
* ```
*/
function guardTool(client, tool, policy) {
	if (typeof tool.invoke !== "function") throw new Error("@arcjet/guard: guardTool() requires a FunctionTool from tool() (invoke). Pass the result of tool({ execute }), not the options object.");
	if (arcjetProtectedTool in tool) throw new Error("@arcjet/guard: guardTool() cannot wrap a tool that is already guarded; do not double-wrap with @arcjet/guard/openai-agents/v0 or @arcjet/guard/vercel-ai/v7");
	const originalInvoke = tool.invoke.bind(tool);
	const proto = Object.getPrototypeOf(tool);
	const wrapped = Object.defineProperties(Object.create(proto), Object.getOwnPropertyDescriptors(tool));
	const newInvoke = (runContext, input, details) => runGuardedTool(client, tool, policy, runContext, input, () => Promise.resolve(originalInvoke(runContext, input, details)));
	Object.defineProperty(wrapped, "invoke", {
		value: newInvoke,
		writable: true,
		enumerable: true,
		configurable: true
	});
	Object.defineProperty(wrapped, arcjetProtectedTool, {
		value: true,
		enumerable: false,
		configurable: true
	});
	return wrapped;
}
function runGuardedTool(client, tool, policy, runContext, input, execute) {
	const args = toolArgs(input, policy.action);
	let sessionId;
	let rules;
	let policyMetadata;
	try {
		const typedArgs = args;
		sessionId = resolveSessionId(policy, typedArgs);
		rules = typeof policy.rules === "function" ? policy.rules(typedArgs) : policy.rules;
		policyMetadata = typeof policy.metadata === "function" ? policy.metadata(typedArgs) : policy.metadata;
	} catch (error) {
		if (shouldWarn()) console.warn("@arcjet/guard: policy factory for \"%s\" threw; treating as a guard error:", policy.action, error);
		if (policy.onGuardError === "allow") return execute();
		return Promise.resolve(unavailableResult());
	}
	const agentCtx = openaiAgentsContext(isContextSource(runContext) ? runContext : void 0, sessionId === void 0 ? void 0 : { sessionId });
	const mergedMetadata = {
		...agentCtx.metadata,
		...typeof tool.name === "string" && tool.name.length > 0 && { "openai-agents.tool": tool.name },
		...policyMetadata
	};
	return runGuarded(client, {
		action: policy.action,
		rules,
		correlationId: agentCtx.correlationId,
		metadata: mergedMetadata,
		onDeny: (decision) => {
			if (policy.onDeny === void 0) return denialResult(decision);
			try {
				return policy.onDeny(decision);
			} catch (error) {
				if (shouldWarn()) console.warn("@arcjet/guard: onDeny for \"%s\" threw; returning the default denial:", policy.action, error);
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
