import { assertValidAction } from "../../agents/label.js";
import { resolveActorInputs } from "../../agents/actor-inputs.js";
import { shouldWarn } from "../../agents/capture.js";
import { denialResult, unavailableResult } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { jsonSchema } from "ai";
//#region src/vercel-ai/v7/guard-tool.ts
/**
* Backoff hint returned to the model when the guard is unavailable.
*
* A rate-limit denial derives its hint from the denying rule's
* `resetAtUnixSeconds`. This path has nothing to derive from: the fail-open
* decision is synthesized locally with no rate-limit result, and several of the
* conditions that reach here receive no response at all. Five seconds paces a
* model's retry loop — long enough that a retry is not effectively immediate,
* short enough that the agent does not appear hung.
*/
const contextSchema = jsonSchema({
	type: "object",
	properties: {
		correlationId: { type: "string" },
		metadata: { type: "object" }
	},
	required: ["correlationId"]
}, { validate(value) {
	if (value === void 0) return {
		success: true,
		value: void 0
	};
	if (typeof value !== "object" || value === null) return {
		success: false,
		error: /* @__PURE__ */ new Error("@arcjet/guard: toolsContext entry is not an ArcjetAgentContext")
	};
	if (typeof value.correlationId !== "string") return {
		success: false,
		error: /* @__PURE__ */ new Error("@arcjet/guard: toolsContext entry is not an ArcjetAgentContext")
	};
	const metadata = value.metadata;
	if (metadata !== void 0 && (typeof metadata !== "object" || Array.isArray(metadata) || metadata === null)) return {
		success: false,
		error: /* @__PURE__ */ new Error("@arcjet/guard: toolsContext entry is not an ArcjetAgentContext")
	};
	return {
		success: true,
		value
	};
} });
let warnedMissingToolsContext = false;
function warnMissingToolsContext(action) {
	if (warnedMissingToolsContext && !shouldWarn()) return;
	warnedMissingToolsContext = true;
	console.warn(`@arcjet/guard: tool call "${action}" has no ArcjetAgentContext; guard checks run uncorrelated. Pass toolsContext: aiToolsContext(ctx, tools).`);
}
/**
* Wraps an AI SDK tool with guard-gated execution and event capture.
*
* Always runs `guard()` before the tool, submitting `policy.rules` or none; on
* DENY the tool never executes and the model receives an `ArcjetDenialResult`
* (or the result of `policy.onDeny`). On ALLOW — which is what submitting no
* rules returns — the tool runs and the outcome is captured.
*
* Guard API errors behavior depends on `policy.onGuardError` (defaults to `"deny"`):
* - `"deny"` (default): Tool does not execute; the model receives an `ArcjetDenialResult`
*   with `reason: "ERROR"`, `retryable: true`, and a fixed `retryAfterSeconds: 5` hint.
* - `"allow"`: Tool still runs, with a warning gated on `ARCJET_LOG_LEVEL`.
*
* The wrapper injects a `contextSchema` of `ArcjetAgentContext | undefined` to
* carry correlation and metadata, so a tool that declares its own
* `contextSchema` cannot be wrapped.
*
* @param client - Guard client from `launchArcjet()`
* @param tool - The tool to wrap; must have an `execute` function and no `contextSchema`
* @param policy - Execution policy: `action` (required), `rules`, `metadata`, `correlationId` override, `onGuardError`, `onDeny` hook
* @returns A tool with protected `execute`, injected `contextSchema`, and context type `ArcjetAgentContext | undefined`
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { tool, jsonSchema, generateText } from "ai";
* import { guardTool, createAgentContext, aiToolsContext } from "@arcjet/guard/vercel-ai/v7";
*
* const arcjetClient = launchArcjet({ key: process.env.ARCJET_KEY! });
*
* const sendEmailTool = tool({
*   description: "Send an email",
*   inputSchema: jsonSchema<{ to: string; subject: string }>({
*     type: "object",
*     properties: { to: { type: "string" }, subject: { type: "string" } },
*     required: ["to", "subject"],
*   }),
*   execute: async (input) => {
*     // Real email service call
*     return { success: true, messageId: "msg-123" };
*   },
* });
*
* const emailLimit = tokenBucket({
*   refillRate: 5,
*   intervalSeconds: 60,
*   maxTokens: 5,
* });
*
* const protectedEmail = guardTool(arcjetClient, sendEmailTool, {
*   action: "email.sent",
*   onGuardError: "deny", // default — blocks the call if Arcjet is unreachable
*   rules: () => [emailLimit({ key: userId, requested: 1 })],
* });
*
* const ctx = createAgentContext({ correlationId: "req-123" });
* const protectedTools = { sendEmail: protectedEmail };
* const result = await generateText({
*   model: languageModel, // Use a real language model, e.g., from @ai-sdk/openai
*   tools: protectedTools,
*   toolsContext: aiToolsContext(ctx, protectedTools),
*   prompt: "Send a confirmation email",
* });
* ```
*/
function guardTool(client, tool, policy) {
	assertValidAction(policy.action, "guardTool");
	if (typeof tool.execute !== "function") throw new Error("@arcjet/guard: guardTool() requires a tool with an execute function");
	if (tool.contextSchema !== void 0) throw new Error("@arcjet/guard: guardTool() cannot wrap a tool that declares its own contextSchema");
	const originalExecute = tool.execute.bind(tool);
	return {
		...tool,
		[arcjetProtectedTool]: true,
		contextSchema,
		async execute(input, options) {
			const ctx = options.context;
			if (ctx === void 0) warnMissingToolsContext(policy.action);
			const correlationId = policy.correlationId ?? ctx?.correlationId;
			const metadata = {
				...ctx?.metadata,
				...typeof policy.metadata === "function" ? policy.metadata(input) : policy.metadata
			};
			const rules = typeof policy.rules === "function" ? policy.rules(input) : policy.rules;
			return runGuarded(client, {
				action: policy.action,
				rules,
				correlationId,
				metadata,
				resolvePolicy: () => resolveActorInputs(policy, input, ctx),
				...policy.onGuardError !== void 0 && { onGuardError: policy.onGuardError },
				onDeny: (decision) => policy.onDeny === void 0 ? denialResult(decision) : policy.onDeny(decision),
				onUnavailable: () => unavailableResult(),
				execute: () => originalExecute(input, options)
			});
		}
	};
}
//#endregion
export { guardTool };
