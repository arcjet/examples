import { captureEvent, shouldWarn } from "../../agents/capture.js";
import { mastraAgentContext } from "./context.js";
import { denialResult, unavailableResult } from "./denial.js";
import { runGate } from "./gate.js";
//#region src/mastra/v1/hooks.ts
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
function resolveAction(policy, call) {
	if (typeof policy.action === "function") return policy.action(call);
	if (typeof policy.action === "string" && policy.action.length > 0) return policy.action;
	return "tool.invoked";
}
/**
* Mastra tool hooks that gate unwrapped tools (MCP, workspace, toolsets).
*
* `beforeToolCall` runs `guard()` and, on DENY, returns
* `{ proceed: false, output }` so the tool does not execute and the model
* receives a structured denial. `afterToolCall` captures the outcome and
* never blocks.
*
* Use this for tools you did not pass through `guardTool`. Do not also wrap
* the same authored tool with `@arcjet/guard/vercel-ai/v7`.
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardHooks } from "@arcjet/guard/mastra/v1";
* import { Agent } from "@mastra/core/agent";
*
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
* const mcpLimit = tokenBucket({
*   refillRate: 20,
*   intervalSeconds: 60,
*   maxTokens: 20,
* });
*
* export const agent = new Agent({
*   id: "support-agent",
*   name: "support-agent",
*   instructions: "Help the user.",
*   model: "openai/gpt-4o",
*   hooks: guardHooks(arcjet, {
*     action: ({ toolName }) => `${toolName}.invoked`,
*     rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
*   }),
* });
* ```
*/
function guardHooks(client, policy = {}) {
	return {
		async beforeToolCall(hookContext) {
			try {
				const call = {
					toolName: typeof hookContext.toolName === "string" ? hookContext.toolName : "",
					input: hookContext.input
				};
				const action = resolveAction(policy, call);
				const agentCtx = mastraAgentContext(isContextSource(hookContext.context) ? hookContext.context : void 0);
				const rules = typeof policy.rules === "function" ? policy.rules(call) : policy.rules;
				const policyMetadata = typeof policy.metadata === "function" ? policy.metadata(call) : policy.metadata;
				const metadata = {
					...agentCtx.metadata,
					"mastra.phase": "before",
					...call.toolName.length > 0 && { "mastra.tool": call.toolName },
					...policyMetadata
				};
				return await runGate(client, {
					action,
					rules,
					correlationId: agentCtx.correlationId,
					metadata,
					onAllow: () => {},
					onDeny: (decision) => ({
						proceed: false,
						output: denialResult(decision)
					}),
					onUnavailable: () => ({
						proceed: false,
						output: unavailableResult()
					}),
					onGuardError: policy.onGuardError ?? "deny"
				});
			} catch (error) {
				if (shouldWarn()) console.warn("@arcjet/guard: guardHooks beforeToolCall threw; denying the tool:", error);
				if (policy.onGuardError === "allow") return;
				return {
					proceed: false,
					output: unavailableResult()
				};
			}
		},
		afterToolCall(hookContext) {
			try {
				const call = {
					toolName: typeof hookContext.toolName === "string" ? hookContext.toolName : "",
					input: hookContext.input
				};
				const action = resolveAction(policy, call);
				const agentCtx = mastraAgentContext(isContextSource(hookContext.context) ? hookContext.context : void 0);
				const policyMetadata = typeof policy.metadata === "function" ? policy.metadata(call) : policy.metadata;
				const metadata = {
					...agentCtx.metadata,
					"mastra.phase": "after",
					outcome: hookContext.error === void 0 ? "success" : "error",
					...call.toolName.length > 0 && { "mastra.tool": call.toolName },
					...policyMetadata
				};
				captureEvent(client, {
					action,
					...agentCtx.correlationId === void 0 ? {} : { correlationId: agentCtx.correlationId },
					metadata
				});
			} catch {}
		}
	};
}
//#endregion
export { guardHooks };
