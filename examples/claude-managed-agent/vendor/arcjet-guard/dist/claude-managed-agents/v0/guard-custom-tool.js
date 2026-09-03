import { shouldWarn } from "../../agents/capture.js";
import { deniedReason, unavailableReason } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { isCustomToolUseEvent } from "./types.js";
//#region src/claude-managed-agents/v0/guard-custom-tool.ts
function errorResult(event, message) {
	const result = {
		type: "user.custom_tool_result",
		custom_tool_use_id: event.id,
		content: [{
			type: "text",
			text: message
		}],
		is_error: true
	};
	if (typeof event.session_thread_id === "string" && event.session_thread_id.length > 0) result.session_thread_id = event.session_thread_id;
	return result;
}
async function sendDenied(send, result) {
	await send(result);
	return {
		allowed: false,
		result
	};
}
function guardCustomTool(client, callOrTool, policy) {
	if (isRunnableTool(callOrTool)) return wrapRunnableTool(client, callOrTool, policy);
	return runHostedCustomTool(client, callOrTool, policy);
}
function isRunnableTool(value) {
	return typeof value === "object" && value !== null && "run" in value && typeof value.run === "function" && !("event" in value && isCustomToolUseEvent(value.event));
}
async function runHostedCustomTool(client, call, policy) {
	const { event, execute, send } = call;
	if (!isCustomToolUseEvent(event)) throw new Error("@arcjet/guard: guardCustomTool() requires an agent.custom_tool_use event");
	const input = event.input;
	let rules;
	let policyMetadata;
	try {
		rules = typeof policy.rules === "function" ? policy.rules(input) : policy.rules;
		policyMetadata = typeof policy.metadata === "function" ? policy.metadata(input) : policy.metadata;
	} catch (error) {
		if (shouldWarn()) console.warn("@arcjet/guard: policy factory for \"%s\" threw; treating as a guard error:", policy.action, error);
		if (policy.onGuardError === "allow") return {
			allowed: true,
			output: await execute(input)
		};
		return sendDenied(send, errorResult(event, unavailableReason()));
	}
	const metadata = {
		"claude.managed-agents.tool": event.name,
		...policy.context?.metadata,
		...policyMetadata
	};
	const gated = await runGuarded(client, {
		action: policy.action,
		rules,
		correlationId: policy.context?.correlationId,
		metadata,
		onDeny: (decision) => ({
			allowed: false,
			result: errorResult(event, deniedReason(decision))
		}),
		onUnavailable: () => ({
			allowed: false,
			result: errorResult(event, unavailableReason())
		}),
		execute: async () => {
			return {
				allowed: true,
				output: await execute(input)
			};
		},
		onGuardError: policy.onGuardError ?? "deny"
	});
	if (!gated.allowed) return sendDenied(send, gated.result);
	return gated;
}
function wrapRunnableTool(client, tool, policy) {
	if (typeof tool.run !== "function") throw new TypeError("@arcjet/guard: guardCustomTool() requires a tool with a run function");
	if (arcjetProtectedTool in tool) throw new Error("@arcjet/guard: guardCustomTool() cannot wrap a tool that is already guarded");
	const originalRun = tool.run.bind(tool);
	const proto = Object.getPrototypeOf(tool);
	const wrapped = Object.defineProperties(Object.create(proto), Object.getOwnPropertyDescriptors(tool));
	const newRun = async (input, context) => {
		let rules;
		let policyMetadata;
		try {
			rules = typeof policy.rules === "function" ? policy.rules(input) : policy.rules;
			policyMetadata = typeof policy.metadata === "function" ? policy.metadata(input) : policy.metadata;
		} catch (error) {
			if (shouldWarn()) console.warn("@arcjet/guard: policy factory for \"%s\" threw; treating as a guard error:", policy.action, error);
			if (policy.onGuardError === "allow") return await originalRun(input, context);
			throw new Error(unavailableReason(), { cause: error });
		}
		const toolName = typeof tool.name === "string" && tool.name.length > 0 ? tool.name : void 0;
		const metadata = {
			...toolName !== void 0 && { "claude.managed-agents.tool": toolName },
			...policy.context?.metadata,
			...policyMetadata
		};
		return runGuarded(client, {
			action: policy.action,
			rules,
			correlationId: policy.context?.correlationId,
			metadata,
			onDeny: (decision) => {
				throw new Error(deniedReason(decision));
			},
			onUnavailable: () => {
				throw new Error(unavailableReason());
			},
			execute: () => Promise.resolve(originalRun(input, context)),
			onGuardError: policy.onGuardError ?? "deny"
		});
	};
	Object.defineProperty(wrapped, "run", {
		value: newRun,
		writable: true,
		enumerable: true,
		configurable: true
	});
	Object.defineProperty(wrapped, arcjetProtectedTool, {
		value: true,
		enumerable: false,
		configurable: true
	});
	return wrapped;
}
//#endregion
export { guardCustomTool };
