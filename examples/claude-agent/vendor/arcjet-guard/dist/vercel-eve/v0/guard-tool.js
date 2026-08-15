import { retryAfterSeconds } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { ArcjetDeniedError, ArcjetGuardUnavailableError } from "../../agents/guard-action.js";
import { eveAgentContext } from "./context.js";
import { deniedReason } from "./denial.js";
//#region src/vercel-eve/v0/guard-tool.ts
/**
* Wraps an authored Eve tool with guard-gated execution and event capture.
*
* Always runs `guard()` before the tool, submitting `policy.rules` or none; on
* DENY the tool never executes and the wrapper throws `ArcjetDeniedError`
* (or returns the result of `policy.onDeny`). On ALLOW — which is what
* submitting no rules returns — the tool runs and the outcome is captured.
*
* The returned definition carries both of Eve's stamped symbols: the enumerable
* `eve:tool-brand` and the non-enumerable `eve.definition-source-key` that
* `toolResultFrom` uses to match results to their definition in channel
* handlers. Both are preserved; a plain object spread would lose the second one.
*
* Guard API errors behavior depends on `policy.onGuardError` (defaults to `"deny"`):
* - `"deny"` (default): Tool does not execute; an `ArcjetGuardUnavailableError` is thrown.
* - `"allow"`: Tool still runs, with a warning gated on `ARCJET_LOG_LEVEL`.
*
* Unlike `guardApproval`, this helper **may** throw: a thrown denial or unavailable
* error reaches Eve, which projects it as `action.result` with `status: "failed"`
* and an `ActionResultError`. Reach for `guardApproval` instead when the tool
* declares an `outputSchema` or comes from a connection — a tool that declares an
* output contract should not silently return something else.
*
* **Limitation:** Static authored tools are supported; dynamically-defined tools
* (`defineDynamic`) are not, because their `execute` functions are hoisted by
* a compiler pass that would not see through the wrapper.
*
* @param client - Guard client from `launchArcjet()`
* @param tool - The authored tool to wrap; must have an `execute` function
* @param policy - Execution policy: `action` (required), `rules`, `metadata`, `onGuardError`, `onDeny`
* @returns A tool with protected `execute`, preserving both Eve symbols
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardTool } from "@arcjet/guard/vercel-eve/v0";
* import { defineTool } from "eve/tools";
* import type { ToolDefinition } from "eve/tools";
*
* const arcjetClient = launchArcjet({ key: process.env["ARCJET_KEY"]! });
*
* const emailLimit = tokenBucket({
*   refillRate: 5,
*   intervalSeconds: 60,
*   maxTokens: 5,
* });
*
* const sendEmail = defineTool<{ to: string }, { messageId: string }>({
*   description: "Send an email",
*   inputSchema: {
*     type: "object",
*     properties: { to: { type: "string" } },
*     required: ["to"],
*   },
*   execute: async (input) => ({ messageId: `msg-for-${input.to}` }),
* });
*
* // A denial throws ArcjetDeniedError, which Eve projects as a failed
* // `action.result`. Reach for `guardApproval` instead when the tool declares
* // an `outputSchema` or comes from a connection.
* const protectedEmail: ToolDefinition<{ to: string }, { messageId: string }> =
*   guardTool(arcjetClient, sendEmail, {
*     action: "email.sent",
*     onGuardError: "deny", // default — blocks the call if Arcjet is unreachable
*     rules: (input) => [emailLimit({ key: input.to, requested: 1 })],
*   });
*
* export default protectedEmail;
* ```
*/
function guardTool(client, tool, policy) {
	if (typeof tool.execute !== "function") throw new Error("@arcjet/guard: guardTool() requires a tool with an execute function");
	const originalExecute = tool.execute.bind(tool);
	const wrapped = Object.defineProperties({}, Object.getOwnPropertyDescriptors(tool));
	wrapped.execute = async (input, ctx) => {
		const agentCtx = eveAgentContext(ctx);
		const metadata = {
			...agentCtx.metadata,
			...typeof ctx.toolName === "string" && ctx.toolName.length > 0 && { "eve.tool": ctx.toolName },
			...typeof ctx.callId === "string" && ctx.callId.length > 0 && { "eve.call": ctx.callId }
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
				if (policy.onDeny === void 0) throw new ArcjetDeniedError(policy.action, decision);
				if (policy.onDeny === "result") return denialResult(decision);
				return policy.onDeny(decision);
			}),
			onUnavailable: (unavailable) => {
				if (unavailable.kind === "threw") throw new ArcjetGuardUnavailableError(policy.action, { cause: unavailable.error });
				throw new ArcjetGuardUnavailableError(policy.action, { decision: unavailable.decision });
			},
			execute: () => Promise.resolve(originalExecute(input, ctx)),
			onGuardError: policy.onGuardError ?? "deny"
		});
	};
	return wrapped;
}
function denialResult(decision) {
	const isRateLimit = decision.reason === "RATE_LIMIT";
	let retryAfterSecs;
	if (isRateLimit) retryAfterSecs = retryAfterSeconds(decision);
	const message = deniedReason(decision);
	const result = {
		arcjetDenied: true,
		reason: decision.reason,
		message,
		retryable: isRateLimit
	};
	if (isRateLimit && retryAfterSecs !== void 0) result.retryAfterSeconds = retryAfterSecs;
	return result;
}
//#endregion
export { guardTool };
