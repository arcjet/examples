import { shouldWarn } from "../../agents/capture.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { claudeAgentContext } from "./context.js";
import { asCallToolResult, denialCallToolResult, unavailableCallToolResult } from "./denial.js";
//#region src/claude-agent-sdk/v0/guard-tool.ts
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
function resolveSessionId(policy, input) {
	if (typeof policy.sessionId === "function") return policy.sessionId(input);
	if (typeof policy.sessionId === "string" && policy.sessionId.length > 0) return policy.sessionId;
}
/**
* Wraps an authored Claude Agent SDK `tool()` definition with guard-gated
* execution.
*
* Always runs `guard()` before the handler, submitting `policy.rules` or none;
* on DENY the handler never executes and the model receives a `CallToolResult`
* with `isError: true` (or the result of `policy.onDeny`). This helper does
* not throw on DENY.
*
* Guard API errors depend on `policy.onGuardError` (defaults to `"deny"`):
* - `"deny"` (default): Handler does not execute; the model receives
*   `isError: true` with `reason: "ERROR"`.
* - `"allow"`: Handler still runs, with a warning gated on `ARCJET_LOG_LEVEL`.
*
* Correlation is read from the handler `extra` (`session_id`) or
* `policy.sessionId`. No id is minted.
*
* Do not also wrap the same tool with `@arcjet/guard/vercel-ai/v7` or
* `@arcjet/guard/agents`. Annotations and sandbox settings are not
* enforcement — they do not replace this wrapper or `guardHooks`.
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardTool } from "@arcjet/guard/claude-agent-sdk/v0";
* import { tool } from "@anthropic-ai/claude-agent-sdk";
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
*     "lookup_order",
*     "Look up an order by number",
*     { orderNumber: z.string() },
*     async ({ orderNumber }) => ({
*       content: [{ type: "text", text: `${orderNumber}: shipped` }],
*     }),
*   ),
*   {
*     action: "order.looked-up",
*     rules: (input) => [lookupLimit({ key: input.orderNumber, requested: 1 })],
*   },
* );
* ```
*/
function guardTool(client, tool, policy) {
	if (typeof tool.handler !== "function") throw new Error("@arcjet/guard: guardTool() requires a tool with a handler function");
	if (arcjetProtectedTool in tool) throw new Error("@arcjet/guard: guardTool() cannot wrap a tool that is already guarded; do not double-wrap with @arcjet/guard/claude-agent-sdk/v0, @arcjet/guard/vercel-ai/v7, or @arcjet/guard/agents");
	const originalHandler = tool.handler.bind(tool);
	const proto = Object.getPrototypeOf(tool);
	const wrapped = Object.defineProperties(Object.create(proto), Object.getOwnPropertyDescriptors(tool));
	wrapped.handler = async (input, extra) => {
		const source = isContextSource(extra) ? extra : void 0;
		const sessionId = resolveSessionId(policy, input);
		const agentCtx = claudeAgentContext(source, sessionId === void 0 ? void 0 : { sessionId });
		const metadata = {
			...agentCtx.metadata,
			...typeof tool.name === "string" && tool.name.length > 0 && { "claude.tool": tool.name }
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
			onDeny: (decision) => {
				const fallback = denialCallToolResult(decision);
				if (policy.onDeny === void 0) return fallback;
				try {
					return asCallToolResult(policy.onDeny(decision), fallback);
				} catch (error) {
					if (shouldWarn()) console.warn("@arcjet/guard: onDeny for \"%s\" threw; returning the default denial:", policy.action, error);
					return fallback;
				}
			},
			onUnavailable: () => unavailableCallToolResult(),
			execute: () => {
				return Promise.resolve(originalHandler(input, extra));
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
