import { shouldWarn } from "../../agents/capture.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { mastraAgentContext } from "./context.js";
import { denialResult, unavailableResult } from "./denial.js";
//#region src/mastra/v1/guard-tool.ts
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
/**
* Wraps a Mastra `createTool({ execute })` with guard-gated execution.
*
* Always runs `guard()` before the tool, submitting `policy.rules` or none; on
* DENY the tool never executes and the model receives an `ArcjetDenialResult`
* (or the result of `policy.onDeny`). This helper does not throw on DENY.
*
* Guard API errors depend on `policy.onGuardError` (defaults to `"deny"`):
* - `"deny"` (default): Tool does not execute; the model receives an
*   `ArcjetDenialResult` with `reason: "ERROR"`.
* - `"allow"`: Tool still runs, with a warning gated on `ARCJET_LOG_LEVEL`.
*
* Correlation is read from the tool's execution context (`requestContext`,
* `agent.threadId` / `resourceId`, `workflow.runId`). No id is minted.
*
* Do not also wrap the same tool with `@arcjet/guard/vercel-ai/v7`.
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardTool } from "@arcjet/guard/mastra/v1";
* import { createTool } from "@mastra/core/tools";
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
*   createTool({
*     id: "lookup-order",
*     description: "Look up an order by number",
*     inputSchema: z.object({ orderNumber: z.string() }),
*     execute: async ({ orderNumber }) => ({ orderNumber, status: "shipped" }),
*   }),
*   {
*     action: "order.looked-up",
*     rules: (input) => [lookupLimit({ key: input.orderNumber, requested: 1 })],
*   },
* );
* ```
*/
function guardTool(client, tool, policy) {
	if (typeof tool.execute !== "function") throw new Error("@arcjet/guard: guardTool() requires a tool with an execute function");
	if (arcjetProtectedTool in tool) throw new Error("@arcjet/guard: guardTool() cannot wrap a tool that is already guarded; do not double-wrap with @arcjet/guard/mastra/v1 or @arcjet/guard/vercel-ai/v7");
	const originalExecute = tool.execute.bind(tool);
	const proto = Object.getPrototypeOf(tool);
	const wrapped = Object.defineProperties(Object.create(proto), Object.getOwnPropertyDescriptors(tool));
	wrapped.execute = async (input, context) => {
		const agentCtx = mastraAgentContext(isContextSource(context) ? context : void 0);
		const metadata = {
			...agentCtx.metadata,
			...typeof tool.id === "string" && tool.id.length > 0 && { "mastra.tool": tool.id }
		};
		const rules = typeof policy.rules === "function" ? policy.rules(input) : policy.rules;
		const policyMetadata = typeof policy.metadata === "function" ? policy.metadata(input) : policy.metadata;
		const mergedMetadata = {
			...metadata,
			...policyMetadata
		};
		return await runGuarded(client, {
			action: policy.action,
			rules,
			correlationId: agentCtx.correlationId,
			metadata: mergedMetadata,
			onDeny: ((decision) => {
				if (policy.onDeny === void 0) return denialResult(decision);
				try {
					return policy.onDeny(decision);
				} catch (error) {
					if (shouldWarn()) console.warn("@arcjet/guard: onDeny for \"%s\" threw; returning the default denial:", policy.action, error);
					return denialResult(decision);
				}
			}),
			onUnavailable: () => unavailableResult(),
			execute: () => {
				const executeContext = context;
				return Promise.resolve(originalExecute(input, executeContext));
			},
			onGuardError: policy.onGuardError ?? "deny"
		});
	};
	Object.defineProperty(wrapped, arcjetProtectedTool, {
		value: true,
		enumerable: false,
		configurable: true
	});
	return wrapped;
}
//#endregion
export { guardTool };
