import { assertValidAction } from "../../agents/label.js";
import { resolveActorInputs } from "../../agents/actor-inputs.js";
import { captureEvent, shouldWarn } from "../../agents/capture.js";
import { deniedReason, unavailableReason } from "../../agents/denial.js";
import { claudeAgentContext } from "./context.js";
import { runGate } from "./gate.js";
//#region src/claude-agent-sdk/v0/hooks.ts
/**
* Resolve one exclusion to the exact tool name `PreToolUse` reports.
*
* An authored tool reaches hooks as `mcp__<server>__<tool>`, so the object form
* builds that name from the server it was registered under rather than asking
* the caller to hand-write the prefix.
*/
function exclusionToolName(exclusion) {
	return typeof exclusion === "string" ? exclusion : `mcp__${exclusion.server}__${exclusion.name}`;
}
/**
* Whether `PreToolUse` should skip this tool because `guardTool` already guards
* it.
*
* Matching is **exact** against the name the hook reports. It deliberately does
* not treat a bare authored name as matching every MCP-qualified tool ending in
* it: two servers can expose the same tool name, and only one of them may be
* wrapped, so a loose match would silently drop the gate on an unprotected
* tool. Name the server with `{ server, name }` when excluding an authored tool.
*/
function isExcludedTool(toolName, exclude) {
	if (exclude === void 0 || exclude.length === 0 || toolName.length === 0) return false;
	return exclude.some((exclusion) => exclusionToolName(exclusion) === toolName);
}
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
	if (typeof policy.action === "string" && policy.action !== "") assertValidAction(policy.action, "guardHooks");
	if (typeof policy.inbound?.action === "string" && policy.inbound.action !== "") assertValidAction(policy.inbound.action, "guardHooks inbound");
	const inboundPolicy = policy.inbound ?? {};
	const preToolUse = async (input) => {
		try {
			const hookInput = input;
			const call = {
				toolName: stringField(hookInput.tool_name),
				input: hookInput.tool_input
			};
			if (isExcludedTool(call.toolName, policy.exclude)) return {};
			const action = resolveToolAction(policy, call);
			const source = isContextSource(hookInput) ? hookInput : void 0;
			const agentCtx = claudeAgentContext(source, policy.sessionId === void 0 ? void 0 : { sessionId: policy.sessionId });
			const rules = typeof policy.rules === "function" ? policy.rules(call) : policy.rules;
			const policyMetadata = typeof policy.metadata === "function" ? policy.metadata(call) : policy.metadata;
			const metadata = {
				...agentCtx.metadata,
				"claude.phase": "before",
				...call.toolName.length > 0 && { "claude.tool": call.toolName },
				...policyMetadata
			};
			const remote = await resolveActorInputs(policy, call, hookInput);
			return await runGate(client, {
				action,
				rules,
				correlationId: agentCtx.correlationId,
				metadata,
				...remote,
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
			const source = isContextSource(hookInput) ? hookInput : void 0;
			const agentCtx = claudeAgentContext(source, policy.sessionId === void 0 ? void 0 : { sessionId: policy.sessionId });
			const rules = typeof inboundPolicy.rules === "function" ? inboundPolicy.rules(inbound) : inboundPolicy.rules;
			const policyMetadata = typeof inboundPolicy.metadata === "function" ? inboundPolicy.metadata(inbound) : inboundPolicy.metadata;
			const metadata = {
				...agentCtx.metadata,
				"claude.phase": "inbound",
				...policyMetadata
			};
			const remote = await resolveActorInputs(inboundPolicy, inbound, hookInput);
			return await runGate(client, {
				action,
				rules,
				correlationId: agentCtx.correlationId,
				metadata,
				...remote,
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
			const source = isContextSource(hookInput) ? hookInput : void 0;
			const agentCtx = claudeAgentContext(source, policy.sessionId === void 0 ? void 0 : { sessionId: policy.sessionId });
			const policyMetadata = typeof policy.metadata === "function" ? policy.metadata(call) : policy.metadata;
			const metadata = {
				...agentCtx.metadata,
				"claude.phase": "after",
				outcome: "success",
				...call.toolName.length > 0 && { "claude.tool": call.toolName },
				...policyMetadata
			};
			const correlation = agentCtx.correlationId === void 0 ? {} : { correlationId: agentCtx.correlationId };
			captureEvent(client, {
				action,
				...correlation,
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
export { guardHooks, isExcludedTool };
