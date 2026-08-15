import { captureEvent, shouldWarn } from "../../agents/capture.js";
import { claudeAgentContext } from "./context.js";
import { deniedReason, unavailableReason } from "./denial.js";
import { runGate } from "./gate.js";
//#region src/claude-agent-sdk/v0/hooks.ts
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
function resolveToolAction(policy, call) {
	if (typeof policy.action === "function") return policy.action(call);
	if (typeof policy.action === "string" && policy.action.length > 0) return policy.action;
	return "tool.invoked";
}
function resolveInboundAction(policy, input) {
	if (typeof policy.action === "function") return policy.action(input);
	if (typeof policy.action === "string" && policy.action.length > 0) return policy.action;
	return "message.received";
}
function stringField(value) {
	return typeof value === "string" ? value : "";
}
function preToolUseDeny(reason) {
	return { hookSpecificOutput: {
		hookEventName: "PreToolUse",
		permissionDecision: "deny",
		permissionDecisionReason: reason
	} };
}
function userPromptBlock(reason) {
	return {
		decision: "block",
		reason
	};
}
/**
* Claude Agent SDK hooks that screen inbound prompts and gate unwrapped tools.
*
* Registers three events:
* - `UserPromptSubmit` — inbound screen. DENY is `{ decision: "block" }`.
* - `PreToolUse` — the only deny for built-ins and unwrapped MCP. DENY is
*   `permissionDecision: "deny"`.
* - `PostToolUse` — capture only; never blocks.
*
* Use this for tools you did not pass through `guardTool`. Do not also wrap
* the same authored tool with `@arcjet/guard/vercel-ai/v7`. Do not put
* policy on `canUseTool`.
*
* @example
* ```ts
* import { launchArcjet, detectPromptInjection, tokenBucket } from "@arcjet/guard";
* import { guardHooks } from "@arcjet/guard/claude-agent-sdk/v0";
* import { query } from "@anthropic-ai/claude-agent-sdk";
*
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
* const mcpLimit = tokenBucket({
*   refillRate: 20,
*   intervalSeconds: 60,
*   maxTokens: 20,
* });
*
* const sessionId = conversationId;
*
* for await (const message of query({
*   prompt: userText,
*   options: {
*     sessionId,
*     hooks: guardHooks(arcjet, {
*       sessionId,
*       action: ({ toolName }) => `${toolName}.invoked`,
*       rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
*       inbound: {
*         action: "message.received",
*         rules: ({ prompt }) => [detectPromptInjection()(prompt)],
*       },
*     }),
*   },
* })) {
*   void message;
* }
* ```
*/
function guardHooks(client, policy = {}) {
	const inboundPolicy = policy.inbound ?? {};
	const preToolUse = async (input) => {
		try {
			const hookInput = input;
			const call = {
				toolName: stringField(hookInput.tool_name),
				input: hookInput.tool_input
			};
			const action = resolveToolAction(policy, call);
			const agentCtx = claudeAgentContext(isContextSource(hookInput) ? hookInput : void 0, policy.sessionId === void 0 ? void 0 : { sessionId: policy.sessionId });
			const rules = typeof policy.rules === "function" ? policy.rules(call) : policy.rules;
			const policyMetadata = typeof policy.metadata === "function" ? policy.metadata(call) : policy.metadata;
			const metadata = {
				...agentCtx.metadata,
				"claude.phase": "before",
				...call.toolName.length > 0 && { "claude.tool": call.toolName },
				...policyMetadata
			};
			return await runGate(client, {
				action,
				rules,
				correlationId: agentCtx.correlationId,
				metadata,
				onAllow: () => ({}),
				onDeny: (decision) => preToolUseDeny(deniedReason(decision)),
				onUnavailable: () => preToolUseDeny(unavailableReason()),
				onGuardError: policy.onGuardError ?? "deny"
			});
		} catch (error) {
			if (shouldWarn()) console.warn("@arcjet/guard: guardHooks PreToolUse threw; denying the tool:", error);
			if (policy.onGuardError === "allow") return {};
			return preToolUseDeny(unavailableReason());
		}
	};
	const userPromptSubmit = async (input) => {
		try {
			const hookInput = input;
			const inbound = { prompt: stringField(hookInput.prompt) };
			const action = resolveInboundAction(inboundPolicy, inbound);
			const agentCtx = claudeAgentContext(isContextSource(hookInput) ? hookInput : void 0, policy.sessionId === void 0 ? void 0 : { sessionId: policy.sessionId });
			const rules = typeof inboundPolicy.rules === "function" ? inboundPolicy.rules(inbound) : inboundPolicy.rules;
			const policyMetadata = typeof inboundPolicy.metadata === "function" ? inboundPolicy.metadata(inbound) : inboundPolicy.metadata;
			const metadata = {
				...agentCtx.metadata,
				"claude.phase": "inbound",
				...policyMetadata
			};
			return await runGate(client, {
				action,
				rules,
				correlationId: agentCtx.correlationId,
				metadata,
				onAllow: () => ({}),
				onDeny: (decision) => userPromptBlock(deniedReason(decision)),
				onUnavailable: () => userPromptBlock(unavailableReason()),
				onGuardError: inboundPolicy.onGuardError ?? policy.onGuardError ?? "deny"
			});
		} catch (error) {
			if (shouldWarn()) console.warn("@arcjet/guard: guardHooks UserPromptSubmit threw; blocking the prompt:", error);
			if ((inboundPolicy.onGuardError ?? policy.onGuardError) === "allow") return {};
			return userPromptBlock(unavailableReason());
		}
	};
	const postToolUse = (input) => {
		try {
			const hookInput = input;
			const call = {
				toolName: stringField(hookInput.tool_name),
				input: hookInput.tool_input
			};
			const action = resolveToolAction(policy, call);
			const agentCtx = claudeAgentContext(isContextSource(hookInput) ? hookInput : void 0, policy.sessionId === void 0 ? void 0 : { sessionId: policy.sessionId });
			const policyMetadata = typeof policy.metadata === "function" ? policy.metadata(call) : policy.metadata;
			const metadata = {
				...agentCtx.metadata,
				"claude.phase": "after",
				outcome: "success",
				...call.toolName.length > 0 && { "claude.tool": call.toolName },
				...policyMetadata
			};
			captureEvent(client, {
				action,
				...agentCtx.correlationId === void 0 ? {} : { correlationId: agentCtx.correlationId },
				metadata
			});
		} catch {}
		return Promise.resolve({});
	};
	return {
		PreToolUse: [{ hooks: [preToolUse] }],
		UserPromptSubmit: [{ hooks: [userPromptSubmit] }],
		PostToolUse: [{ hooks: [postToolUse] }]
	};
}
//#endregion
export { guardHooks };
