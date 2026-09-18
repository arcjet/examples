import { assertValidAction } from "../../agents/label.js";
import { resolveActorInputs } from "../../agents/actor-inputs.js";
import { captureEvent, shouldWarn } from "../../agents/capture.js";
import { deniedReason, unavailableReason } from "../../agents/denial.js";
import { eveAgentContext } from "./context.js";
import { runGate } from "./gate.js";
//#region src/vercel-eve/v0/guard-approval.ts
function guardApproval(client, policy) {
	assertValidAction(policy.action, "guardApproval");
	if (policy.response !== void 0) assertValidAction(policy.response.action, "guardApproval response");
	const request = createRequestApproval(client, policy);
	if (policy.response === void 0) return request;
	return {
		request,
		response: createResponseApproval(client, policy.response)
	};
}
function allowedResponse() {
	return { status: "allowed" };
}
function rejectedResponse(reason) {
	return {
		status: "rejected",
		reason
	};
}
function createRequestApproval(client, policy) {
	return (ctx) => {
		const allowStatus = () => policy.onAllow ?? "not-applicable";
		return evaluateApprovalPolicy(client, policy, ctx, {
			deriveAgentContext: () => eveAgentContext(ctx),
			extraMetadata: () => requestPhaseMetadata(ctx),
			onAllow: allowStatus,
			onDeny: (decision) => policy.onDeny?.(decision) ?? {
				type: "denied",
				reason: deniedReason(decision)
			},
			onUnavailable: () => policy.onGuardError === "allow" ? allowStatus() : {
				type: "denied",
				reason: unavailableReason()
			},
			warnKind: "approval"
		});
	};
}
function createResponseApproval(client, policy) {
	return (ctx) => {
		return evaluateApprovalPolicy(client, policy, ctx, {
			deriveAgentContext: () => responseAgentContext(ctx),
			extraMetadata: () => responsePhaseMetadata(ctx),
			onAllow: allowedResponse,
			onDeny: (decision) => rejectedResponse(deniedReason(decision)),
			onUnavailable: () => policy.onGuardError === "allow" ? allowedResponse() : rejectedResponse(unavailableReason()),
			warnKind: "approval-response"
		});
	};
}
function requestPhaseMetadata(ctx) {
	return {
		"eve.phase": "approval",
		...typeof ctx?.toolName === "string" && ctx.toolName.length > 0 && { "eve.tool": ctx.toolName },
		...typeof ctx?.callId === "string" && ctx.callId.length > 0 && { "eve.call": ctx.callId }
	};
}
function responsePhaseMetadata(ctx) {
	const request = ctx?.request;
	return {
		"eve.phase": "approval-response",
		...typeof request?.toolName === "string" && request.toolName.length > 0 && { "eve.tool": request.toolName },
		...typeof request?.callId === "string" && request.callId.length > 0 && { "eve.call": request.callId },
		...typeof request?.requestId === "string" && request.requestId.length > 0 && { "eve.request": request.requestId }
	};
}
function responseSessionId(ctx) {
	const id = ctx?.session?.id;
	if (typeof id !== "string" || id === "") return;
	return id;
}
/**
* Map Eve's response-time context onto the session shape `eveAgentContext`
* already understands. The responder is `auth.current`, so the existing
* `user` metadata field and session correlation apply to the person answering
* the parked request rather than the original caller.
*/
function responseAgentContext(ctx) {
	const sessionId = responseSessionId(ctx);
	const sessionContext = {
		session: {
			id: sessionId ?? "",
			auth: {
				current: ctx?.responder ?? null,
				initiator: ctx?.session?.initiator ?? null
			},
			turn: ctx?.session?.turn ?? {
				id: "",
				sequence: 0
			},
			...ctx?.session?.parent === void 0 ? {} : { parent: ctx.session.parent }
		},
		getSandbox() {
			return Promise.reject(/* @__PURE__ */ new Error("@arcjet/guard: approval response context has no sandbox"));
		},
		getSkill() {
			throw new Error("@arcjet/guard: approval response context has no skill");
		}
	};
	return omitBlankSessionCapture(eveAgentContext(sessionContext), sessionId);
}
function omitBlankSessionCapture(agent, sessionId) {
	if (sessionId !== void 0) return agent;
	const metadata = agent.metadata;
	if (metadata === void 0 || metadata["eve.session"] !== "") return agent;
	const rest = { ...metadata };
	delete rest["eve.session"];
	return {
		correlationId: agent.correlationId,
		...Object.keys(rest).length > 0 ? { metadata: rest } : {}
	};
}
async function resolveApprovalCallbacks(client, policy, ctx, options, agentCtx, metadata) {
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
	let resolvedMetadata = metadata;
	try {
		const policyMetadata = typeof policy.metadata === "function" ? policy.metadata(ctx) : policy.metadata;
		resolvedMetadata = {
			...metadata,
			...policyMetadata
		};
	} catch (error) {
		metadataResolutionFailed = true;
		metadataResolutionError = error;
	}
	let remote = {};
	let remoteResolutionFailed = false;
	let remoteResolutionError;
	try {
		remote = await resolveActorInputs(policy, ctx);
	} catch (error) {
		remoteResolutionFailed = true;
		remoteResolutionError = error;
	}
	if (ruleResolutionFailed || metadataResolutionFailed || remoteResolutionFailed) {
		const failClosed = policy.onGuardError !== "allow";
		const correlation = agentCtx.correlationId === void 0 ? {} : { correlationId: agentCtx.correlationId };
		const error = ruleResolutionFailed ? ruleResolutionError : metadataResolutionFailed ? metadataResolutionError : remoteResolutionError;
		warnCallbackFailure(options.warnKind, policy.action, failClosed, error);
		captureEvent(client, {
			action: policy.action,
			...correlation,
			metadata: {
				...resolvedMetadata,
				outcome: "unavailable"
			}
		});
		return {
			status: "failed",
			result: failClosed ? options.onUnavailable() : options.onAllow()
		};
	}
	return {
		status: "resolved",
		rules,
		metadata: resolvedMetadata,
		...remote
	};
}
async function evaluateApprovalPolicy(client, policy, ctx, options) {
	try {
		const agentCtx = options.deriveAgentContext();
		const resolved = await resolveApprovalCallbacks(client, policy, ctx, options, agentCtx, {
			...agentCtx.metadata,
			...options.extraMetadata()
		});
		if (resolved.status === "failed") return resolved.result;
		return await runGate(client, {
			action: policy.action,
			rules: resolved.rules,
			correlationId: agentCtx.correlationId,
			metadata: resolved.metadata,
			...resolved.actor !== void 0 && { actor: resolved.actor },
			...resolved.inputs !== void 0 && { inputs: resolved.inputs },
			onAllow: options.onAllow,
			onDeny: options.onDeny,
			onUnavailable: options.onUnavailable,
			onGuardError: policy.onGuardError ?? "deny"
		});
	} catch (error) {
		const failClosed = policy.onGuardError !== "allow";
		warnCallbackFailure(options.warnKind, policy.action, failClosed, error);
		return failClosed ? options.onUnavailable() : options.onAllow();
	}
}
function warnCallbackFailure(kind, action, failClosed, error) {
	if (!shouldWarn()) return;
	if (kind === "approval-response") {
		if (failClosed) console.warn("@arcjet/guard: approval response policy for \"%s\" could not be evaluated; failing closed:", action, error);
		else console.warn("@arcjet/guard: approval response policy for \"%s\" could not be evaluated; failing open:", action, error);
		return;
	}
	if (failClosed) console.warn("@arcjet/guard: approval policy for \"%s\" could not be evaluated; failing closed:", action, error);
	else console.warn("@arcjet/guard: approval policy for \"%s\" could not be evaluated; failing open:", action, error);
}
//#endregion
export { guardApproval };
