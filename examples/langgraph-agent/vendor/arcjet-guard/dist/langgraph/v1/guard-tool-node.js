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
/**
* Replace every unguarded entry of `tools` with a guarded one, in place.
*
* In place is the whole point. `ToolNode`'s constructor registers
* `func: (input, config) => this.run(input, config)` — an arrow bound to the
* instance being constructed — and `run` reads `this.tools`. Assigning a new
* array to a copied node therefore changes nothing the node actually
* executes: the captured closure keeps reaching the original array. Mutating
* the array the node already holds is what the running graph observes, and it
* also means a caller holding the same node (or the same array) cannot
* bypass Guard through a stale reference.
*/
function guardToolsInPlace(client, tools, policy) {
	for (let index = 0; index < tools.length; index += 1) {
		const tool = tools[index];
		if (tool === void 0 || arcjetProtectedTool in tool) continue;
		tools[index] = guardTool(client, tool, policyForTool(tool, policy));
	}
}
function guardToolNode(client, toolsOrNode, policy = {}) {
	if (Array.isArray(toolsOrNode)) return toolsOrNode.map((tool) => wrapUnbrandedTool(client, tool, policy));
	if (!isToolNodeLike(toolsOrNode)) throw new Error("@arcjet/guard: guardToolNode() requires a ToolNode or an array of tools");
	const node = toolsOrNode;
	if (arcjetProtectedTool in node) throw new Error("@arcjet/guard: guardToolNode() cannot wrap a ToolNode that is already guarded; do not double-wrap with @arcjet/guard/langgraph/v1");
	if (Object.isFrozen(node.tools)) throw new Error("@arcjet/guard: guardToolNode() cannot guard a ToolNode with a frozen tools array; pass the tools through guardToolNode() before constructing the ToolNode");
	guardToolsInPlace(client, node.tools, policy);
	const originalInvoke = node.invoke;
	if (originalInvoke !== void 0) {
		const ownInvoke = Object.getOwnPropertyDescriptor(node, "invoke");
		const newInvoke = (input, config) => {
			guardToolsInPlace(client, node.tools, policy);
			return originalInvoke.call(node, input, config);
		};
		Object.defineProperty(node, "invoke", {
			value: newInvoke,
			writable: true,
			enumerable: ownInvoke?.enumerable ?? false,
			configurable: true
		});
	}
	Object.defineProperty(node, arcjetProtectedTool, {
		value: true,
		enumerable: false,
		configurable: true
	});
	return node;
}
//#endregion
export { guardToolNode };
