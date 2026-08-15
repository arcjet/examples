import { captureEvent, shouldWarn } from "../../agents/capture.js";
import { eveAgentContext } from "./context.js";
import { deniedReason, unavailableReason } from "./denial.js";
import { runGate } from "./gate.js";
//#region src/vercel-eve/v0/guard-approval.ts
/**
* Gate for Eve tool and connection calls using Arcjet guard policies.
*
* Returns an `Approval` function assignable to `ToolDefinition.approval`,
* `OpenAPIConnectionDefinition.approval`, or `McpClientConnectionDefinition.approval`.
*
* The returned function:
* 1. Derives context from the Eve `ApprovalContext`
* 2. Resolves rules and metadata (each may be a function of ctx)
* 3. Calls the guard with merged metadata including `eve.phase: "approval"`, `eve.tool`, and `eve.call`
* 4. On ALLOW (with no failed-open), resolves to `policy.onAllow` or `"not-applicable"`
* 5. On DENY, resolves to `policy.onDeny(decision)` or a default denial status
* 6. On unavailable (guard threw or failed open with `onGuardError: "deny"`), resolves to
*    a denial status or `policy.onAllow` depending on the mode
* 7. Never throws, for any input
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardApproval } from "@arcjet/guard/vercel-eve/v0";
* import { defineOpenAPIConnection } from "eve/connections";
* import type { OpenAPIConnectionDefinition } from "eve/connections";
*
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
* const callLimit = tokenBucket({ refillRate: 5, intervalSeconds: 60, maxTokens: 5 });
*
* // A connection's tools have no local `execute` to wrap, so the approval
* // gate is the only enforcement point that reaches them. `onAllow` still
* // requires a human after the policy passes — Eve allows one `approval`
* // function per connection, so there is nowhere to compose `once()` or
* // `always()` from `eve/tools/approval` alongside this.
* const weather: OpenAPIConnectionDefinition = defineOpenAPIConnection({
*   description: "Weather API",
*   spec: "https://api.example.com/openapi.json",
*   approval: guardApproval(arcjet, {
*     action: "weather.fetched",
*     rules: (ctx) => [callLimit({ key: ctx.session.id, requested: 1 })],
*     onAllow: "user-approval",
*   }),
* });
*
* export default weather;
* ```
*/
function guardApproval(client, policy) {
	return async (ctx) => {
		const allowStatus = () => policy.onAllow ?? "not-applicable";
		try {
			const agentCtx = eveAgentContext(ctx);
			let metadata = {
				...agentCtx.metadata,
				"eve.phase": "approval",
				...typeof ctx.toolName === "string" && ctx.toolName.length > 0 && { "eve.tool": ctx.toolName },
				...typeof ctx.callId === "string" && ctx.callId.length > 0 && { "eve.call": ctx.callId }
			};
			let ruleResolutionFailed = false;
			let ruleResolutionError;
			let rules;
			try {
				rules = typeof policy.rules === "function" ? policy.rules(ctx) : policy.rules;
			} catch (error) {
				ruleResolutionFailed = true;
				ruleResolutionError = error;
			}
			let metadataResolutionFailed = false;
			let metadataResolutionError;
			try {
				const policyMetadata = typeof policy.metadata === "function" ? policy.metadata(ctx) : policy.metadata;
				metadata = {
					...metadata,
					...policyMetadata
				};
			} catch (error) {
				metadataResolutionFailed = true;
				metadataResolutionError = error;
			}
			if (ruleResolutionFailed || metadataResolutionFailed) {
				const failClosed = policy.onGuardError !== "allow";
				const correlation = agentCtx.correlationId === void 0 ? {} : { correlationId: agentCtx.correlationId };
				const error = ruleResolutionFailed ? ruleResolutionError : metadataResolutionError;
				warnCallbackFailure(policy.action, failClosed, error);
				captureEvent(client, {
					action: policy.action,
					...correlation,
					metadata: {
						...metadata,
						outcome: "unavailable"
					}
				});
				return failClosed ? {
					type: "denied",
					reason: unavailableReason()
				} : allowStatus();
			}
			return await runGate(client, {
				action: policy.action,
				rules,
				correlationId: agentCtx.correlationId,
				metadata,
				onAllow: allowStatus,
				onDeny: (decision) => policy.onDeny?.(decision) ?? {
					type: "denied",
					reason: deniedReason(decision)
				},
				onUnavailable: () => policy.onGuardError === "allow" ? allowStatus() : {
					type: "denied",
					reason: unavailableReason()
				},
				onGuardError: policy.onGuardError ?? "deny"
			});
		} catch (error) {
			const failClosed = policy.onGuardError !== "allow";
			warnCallbackFailure(policy.action, failClosed, error);
			return failClosed ? {
				type: "denied",
				reason: unavailableReason()
			} : allowStatus();
		}
	};
}
function warnCallbackFailure(action, failClosed, error) {
	if (!shouldWarn()) return;
	if (failClosed) console.warn("@arcjet/guard: approval policy for \"%s\" could not be evaluated; failing closed:", action, error);
	else console.warn("@arcjet/guard: approval policy for \"%s\" could not be evaluated; failing open:", action, error);
}
//#endregion
export { guardApproval };
