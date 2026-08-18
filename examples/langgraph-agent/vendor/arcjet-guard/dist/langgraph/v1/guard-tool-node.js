import { arcjetProtectedTool } from "../../agents/internal.js";
import { guardTool } from "./guard-tool.js";
//#region src/langgraph/v1/guard-tool-node.ts
function isToolNodeLike(value) {
	return value !== null && typeof value === "object" && "tools" in value && Array.isArray(value.tools) && "invoke" in value && typeof value.invoke === "function";
}
function resolveAction(policy, call) {
	if (typeof policy.action === "function") return policy.action(call);
	if (typeof policy.action === "string" && policy.action.length > 0) return policy.action;
	return "tool.invoked";
}
function policyForTool(tool, policy) {
	return {
		action: (input) => resolveAction(policy, {
			toolName: tool.name,
			input
		}),
		rules: (input) => {
			const call = {
				toolName: tool.name,
				input
			};
			return typeof policy.rules === "function" ? policy.rules(call) : policy.rules ?? [];
		},
		metadata: (input) => {
			const call = {
				toolName: tool.name,
				input
			};
			return typeof policy.metadata === "function" ? policy.metadata(call) : policy.metadata ?? {};
		},
		...policy.onGuardError !== void 0 && { onGuardError: policy.onGuardError },
		...policy.onDeny !== void 0 && { onDeny: policy.onDeny }
	};
}
function wrapUnbrandedTool(client, tool, policy) {
	if (arcjetProtectedTool in tool) return tool;
	return guardTool(client, tool, policyForTool(tool, policy));
}
function ensureToolsGuarded(client, tools, policy) {
	let changed = false;
	const next = tools.map((tool) => {
		if (arcjetProtectedTool in tool) return tool;
		changed = true;
		return wrapUnbrandedTool(client, tool, policy);
	});
	return changed ? next : tools;
}
function guardToolNode(client, toolsOrNode, policy = {}) {
	if (Array.isArray(toolsOrNode)) return toolsOrNode.map((tool) => wrapUnbrandedTool(client, tool, policy));
	if (!isToolNodeLike(toolsOrNode)) throw new Error("@arcjet/guard: guardToolNode() requires a ToolNode or an array of tools");
	if (arcjetProtectedTool in toolsOrNode) throw new Error("@arcjet/guard: guardToolNode() cannot wrap a ToolNode that is already guarded; do not double-wrap with @arcjet/guard/langgraph/v1");
	const originalInvoke = toolsOrNode.invoke;
	const proto = Object.getPrototypeOf(toolsOrNode);
	const wrapped = Object.defineProperties(Object.create(proto), Object.getOwnPropertyDescriptors(toolsOrNode));
	wrapped.tools = ensureToolsGuarded(client, wrapped.tools, policy);
	const newInvoke = (input, config) => {
		wrapped.tools = ensureToolsGuarded(client, wrapped.tools, policy);
		return originalInvoke.call(wrapped, input, config);
	};
	Object.defineProperty(wrapped, "invoke", {
		value: newInvoke,
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
export { guardToolNode };
