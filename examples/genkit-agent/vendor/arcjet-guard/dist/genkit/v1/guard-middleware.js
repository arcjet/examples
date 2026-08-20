import { shouldWarn } from "../../agents/capture.js";
import { denialResult, unavailableResult } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { genkitContext } from "./context.js";
//#region src/genkit/v1/guard-middleware.ts
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
function isRecord(value) {
	return value !== null && typeof value === "object";
}
function isToolRequestPart(value) {
	if (!isRecord(value) || !isRecord(value["toolRequest"])) return false;
	return typeof value["toolRequest"]["name"] === "string";
}
function resolveAction(policy, call) {
	if (typeof policy.action === "function") return policy.action(call);
	if (typeof policy.action === "string" && policy.action.length > 0) return policy.action;
	return "tool.invoked";
}
function resolveSessionId(policy, call) {
	if (typeof policy.sessionId === "function") return policy.sessionId(call);
	if (typeof policy.sessionId === "string" && policy.sessionId.length > 0) return policy.sessionId;
}
/**
* Best-effort lookup of a registered tool so already-branded
* (`guardTool`) actions can skip a second guard call. Uses the `ai`
* instance Genkit passes to `instantiate` — no value import of `genkit`.
*/
function isRegisteredTool(value) {
	return typeof value === "function" || typeof value === "object" && value !== null;
}
async function lookupRegisteredTool(ai, name) {
	if (ai === null || typeof ai !== "object") return;
	const registry = "registry" in ai ? ai.registry : void 0;
	if (registry === null || typeof registry !== "object") return;
	const lookup = registry.lookupAction;
	if (typeof lookup !== "function") return;
	const candidates = [
		name,
		`/tool/${name}`,
		`/tool.v2/${name}`
	];
	for (const key of candidates) try {
		const found = await lookup.call(registry, key);
		if (isRegisteredTool(found)) return found;
	} catch {}
}
let middlewareSeq = 0;
/**
* A `generate({ use })` middleware whose `tool` hook is the
* generate()-wide gate.
*
* Filesystem middleware tools, MCP tools, and anything not wrapped with
* `guardTool` skip the authored handler. This is the LangGraph
* `guardToolNode` / Claude `guardHooks` equivalent. Put it on
* `ai.generate({ use: [guardMiddleware(...)] })`.
*
* The `tool` hook *can* deny: Genkit's `resolveToolRequest` treats a
* `ToolResponsePart` returned without calling `next()` as a completed
* tool result. This helper does that. It does **not** throw
* `ToolInterruptError` (that sets `finishReason: "interrupted"` and is
* HITL — see `@genkit-ai/middleware` `toolApproval`).
*
* Already-branded tools (`guardTool`) are skipped when they can be
* found on the registry, so Guard is not double-called. Tools that
* cannot be looked up are still gated (the unwrapped / MCP /
* filesystem case).
*
* Correlation is read from the hook `ctx.context` (and documented
* copies). `generate({ context })` is delivered to authored handlers
* via ALS and is **not** copied onto the hook `ctx` today — put the
* same id on `policy.sessionId` when you need tool-time correlation
* through this hook. No id is minted.
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardMiddleware } from "@arcjet/guard/genkit/v1";
*
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
* const mcpLimit = tokenBucket({
*   refillRate: 20,
*   intervalSeconds: 60,
*   maxTokens: 20,
* });
*
* const response = await ai.generate({
*   prompt: userText,
*   tools: [lookupOrder, ...mcpTools],
*   use: [
*     guardMiddleware(arcjet, {
*       action: ({ toolName }) => `${toolName}.invoked`,
*       rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
*       sessionId: conversationId,
*     }),
*   ],
*   context: { sessionId: conversationId },
* });
* ```
*/
function guardMiddleware(client, policy = {}) {
	middlewareSeq += 1;
	return {
		name: `arcjet-guard-${middlewareSeq}`,
		instantiate: (options) => {
			const ai = options !== null && typeof options === "object" && "ai" in options ? options.ai : void 0;
			return { tool: async (req, ctx, next) => {
				if (!isToolRequestPart(req)) return next(req, ctx);
				const toolName = req.toolRequest.name;
				const call = {
					toolName,
					input: req.toolRequest.input ?? {}
				};
				const registered = await lookupRegisteredTool(ai, toolName);
				if (registered !== void 0 && arcjetProtectedTool in registered) return next(req, ctx);
				let action;
				let sessionId;
				let rules;
				let policyMetadata;
				try {
					action = resolveAction(policy, call);
					sessionId = resolveSessionId(policy, call);
					rules = typeof policy.rules === "function" ? policy.rules(call) : policy.rules;
					policyMetadata = typeof policy.metadata === "function" ? policy.metadata(call) : policy.metadata;
				} catch (error) {
					const actionLabel = typeof policy.action === "string" ? policy.action : "tool.invoked";
					if (shouldWarn()) console.warn("@arcjet/guard: policy factory for \"%s\" threw; treating as a guard error:", actionLabel, error);
					if (policy.onGuardError === "allow") return next(req, ctx);
					return denialPart(req, unavailableResult());
				}
				const agentCtx = genkitContext(isContextSource(ctx) ? ctx : void 0, sessionId === void 0 ? void 0 : { sessionId });
				const mergedMetadata = {
					...agentCtx.metadata,
					...toolName.length > 0 && { "genkit.tool": toolName },
					...policyMetadata
				};
				return runGuarded(client, {
					action,
					rules,
					correlationId: agentCtx.correlationId,
					metadata: mergedMetadata,
					onDeny: (decision) => {
						if (policy.onDeny === void 0) return denialPart(req, denialResult(decision));
						try {
							return denialPart(req, policy.onDeny(decision));
						} catch (error) {
							if (shouldWarn()) console.warn("@arcjet/guard: onDeny for \"%s\" threw; returning the default denial:", action, error);
							return denialPart(req, denialResult(decision));
						}
					},
					onUnavailable: () => denialPart(req, unavailableResult()),
					execute: () => next(req, ctx),
					onGuardError: policy.onGuardError ?? "deny"
				});
			} };
		}
	};
}
function denialPart(req, output) {
	const part = { toolResponse: {
		name: req.toolRequest.name,
		output
	} };
	if (req.toolRequest.ref !== void 0) part.toolResponse.ref = req.toolRequest.ref;
	return part;
}
//#endregion
export { guardMiddleware };
