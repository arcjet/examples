import { shouldWarn } from "../../agents/capture.js";
import { denialResult, unavailableResult } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { genkitContext } from "./context.js";
//#region src/genkit/v1/guard-tool.ts
function isContextSource(value) {
	return value !== null && typeof value === "object";
}
/**
* The model-produced arguments. `generate()` invokes a tool with the
* parsed `toolRequest.input` object. Scan those args, not
* `toolRequest.ref`.
*/
function toolArgs(input, action) {
	if (input !== null && typeof input === "object") return input;
	if (typeof input === "string") try {
		return JSON.parse(input);
	} catch {
		return {};
	}
	if (input === void 0) return {};
	if (shouldWarn()) console.warn("@arcjet/guard: guardTool() for \"%s\" was invoked with a %s input; expected the parsed object generate() passes, so no arguments were scanned.", action, input === null ? "null" : typeof input);
	return {};
}
function resolveSessionId(policy, input) {
	if (typeof policy.sessionId === "function") return policy.sessionId(input);
	if (typeof policy.sessionId === "string" && policy.sessionId.length > 0) return policy.sessionId;
}
/**
* `ai.generate({ tools })` does not keep the ToolAction objects. It
* converts them to name/schema definitions (`toToolDefinition`) and
* `resolveTools` looks the live action up on the registry. A wrapper
* that is only a copy would be discarded; the original registered
* action would run unguarded. Overwrite the existing registry entry
* so generate() resolves the guarded callable. Dynamic tools
* (`metadata.dynamic`) are registered from the `tools` array at
* generate() time and do not need this.
*/
function reregisterGuardedTool(original, wrapped) {
	const registry = "__registry" in original ? original.__registry : void 0;
	if (registry === null || typeof registry !== "object") return;
	if (!("actionsById" in registry)) return;
	const store = registry.actionsById;
	if (store === null || typeof store !== "object") return;
	const key = original.__action?.key;
	const actionType = original.__action?.actionType;
	const name = original.__action?.name;
	const candidates = [typeof key === "string" ? key : void 0, typeof actionType === "string" && typeof name === "string" ? `/${actionType}/${name}` : void 0];
	for (const candidate of candidates) if (candidate !== void 0 && Object.hasOwn(store, candidate)) Reflect.set(store, candidate, wrapped);
}
function copyToolDescriptors(tool, onto) {
	const descriptors = Object.getOwnPropertyDescriptors(tool);
	delete descriptors["name"];
	delete descriptors["length"];
	delete descriptors["arguments"];
	delete descriptors["caller"];
	delete descriptors["prototype"];
	Object.defineProperties(onto, descriptors);
}
/**
* Wraps a `defineTool` / `tool()` `ToolAction` so the closed-over
* handler never runs on DENY.
*
* After `ai.defineTool(config, handler)` the runner calls the returned
* action as a function. This helper replaces that callable (and `.run`,
* so a direct `tool.run()` is gated the same way) and always runs
* `guard()` before the original action. On DENY the original action —
* and therefore the authored handler and `outputSchema` validation —
* never runs. The model receives an `ArcjetDenialResult` (or the result
* of `policy.onDeny`) as a completed `toolResponse.output`. This helper
* does not throw on DENY and does not call `interrupt()` /
* `ToolInterruptError` (those are HITL).
*
* `ai.generate({ tools })` converts the array to name/schema
* definitions and looks the live action up on the registry. This helper
* therefore overwrites the original registry entry so generate() cannot
* run the unguarded `defineTool` action. Dynamic tools are registered
* from the `tools` array at generate() time and do not need that.
*
* Guard API errors depend on `policy.onGuardError` (defaults to `"deny"`):
* - `"deny"` (default): handler does not run; the model receives an
*   `ArcjetDenialResult` with `reason: "ERROR"`.
* - `"allow"`: handler still runs, with a warning gated on
*   `ARCJET_LOG_LEVEL`.
*
* Correlation is read from the tool `options.context` (and documented
* copies on the envelope). `generate({ context })` is delivered to the
* authored handler via Genkit's ALS; the wrapper sees it when the
* caller passed `options.context` explicitly, or via `policy.sessionId`.
* No id is minted. `interrupt` / `resumed` / `traceId` are never read.
*
* Filesystem middleware tools, MCP tools, and anything not wrapped with
* `guardTool` skip this path — use `guardMiddleware` for those. Do not
* also wrap the same tool with `@arcjet/guard/vercel-ai/v7`. The shared
* `arcjetProtectedTool` brand throws on a second `guardTool` wrap.
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { guardTool } from "@arcjet/guard/genkit/v1";
* import { genkit, z } from "genkit";
*
* const ai = genkit({ ... });
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
* const lookupLimit = tokenBucket({
*   refillRate: 10,
*   intervalSeconds: 60,
*   maxTokens: 10,
* });
*
* export const lookupOrder = guardTool(
*   arcjet,
*   ai.defineTool(
*     {
*       name: "lookup_order",
*       description: "Look up an order by number",
*       inputSchema: z.object({ orderNumber: z.string() }),
*     },
*     async ({ orderNumber }) => ({ orderNumber, status: "shipped" }),
*   ),
*   {
*     action: "order.looked-up",
*     rules: (input) => [lookupLimit({ key: input.orderNumber, requested: 1 })],
*   },
* );
* ```
*/
function guardTool(client, tool, policy) {
	if (typeof tool !== "function") throw new Error("@arcjet/guard: guardTool() requires a ToolAction from defineTool() (a callable). Pass the result of ai.defineTool(config, handler), not the config object.");
	if (arcjetProtectedTool in tool) throw new Error("@arcjet/guard: guardTool() cannot wrap a tool that is already guarded; do not double-wrap with @arcjet/guard/genkit/v1 or @arcjet/guard/vercel-ai/v7");
	const originalCall = tool.bind(tool);
	const originalRun = typeof tool.run === "function" ? tool.run.bind(tool) : void 0;
	const wrappedFn = function guardedGenkitTool(input, options) {
		return runGuardedTool(client, tool, policy, input, options, () => Promise.resolve(originalCall(input, options)));
	};
	copyToolDescriptors(tool, wrappedFn);
	const wrapped = wrappedFn;
	if (originalRun !== void 0) {
		const newRun = (input, options) => runGuardedTool(client, tool, policy, input, options, () => Promise.resolve(originalRun(input, options)), { wrapRunResult: true });
		Object.defineProperty(wrapped, "run", {
			value: newRun,
			writable: true,
			enumerable: true,
			configurable: true
		});
	}
	Object.defineProperty(wrapped, arcjetProtectedTool, {
		value: true,
		enumerable: false,
		configurable: true
	});
	reregisterGuardedTool(tool, wrapped);
	return wrapped;
}
function isActionResult(value) {
	return value !== null && typeof value === "object" && "result" in value && "telemetry" in value;
}
function runGuardedTool(client, tool, policy, input, options, execute, extras) {
	const args = toolArgs(input, policy.action);
	let sessionId;
	let rules;
	let policyMetadata;
	try {
		const typedArgs = args;
		sessionId = resolveSessionId(policy, typedArgs);
		rules = typeof policy.rules === "function" ? policy.rules(typedArgs) : policy.rules;
		policyMetadata = typeof policy.metadata === "function" ? policy.metadata(typedArgs) : policy.metadata;
	} catch (error) {
		if (shouldWarn()) console.warn("@arcjet/guard: policy factory for \"%s\" threw; treating as a guard error:", policy.action, error);
		if (policy.onGuardError === "allow") return execute();
		return Promise.resolve(extras?.wrapRunResult === true ? {
			result: unavailableResult(),
			telemetry: {
				traceId: "",
				spanId: ""
			}
		} : unavailableResult());
	}
	const agentCtx = genkitContext(isContextSource(options) ? options : void 0, sessionId === void 0 ? void 0 : { sessionId });
	const toolName = typeof tool.__action?.name === "string" && tool.__action.name.length > 0 ? tool.__action.name : void 0;
	const mergedMetadata = {
		...agentCtx.metadata,
		...toolName !== void 0 && { "genkit.tool": toolName },
		...policyMetadata
	};
	const asResult = (value) => extras?.wrapRunResult === true ? {
		result: value,
		telemetry: {
			traceId: "",
			spanId: ""
		}
	} : value;
	return runGuarded(client, {
		action: policy.action,
		rules,
		correlationId: agentCtx.correlationId,
		metadata: mergedMetadata,
		onDeny: (decision) => {
			if (policy.onDeny === void 0) return asResult(denialResult(decision));
			try {
				return asResult(policy.onDeny(decision));
			} catch (error) {
				if (shouldWarn()) console.warn("@arcjet/guard: onDeny for \"%s\" threw; returning the default denial:", policy.action, error);
				return asResult(denialResult(decision));
			}
		},
		onUnavailable: () => asResult(unavailableResult()),
		execute: async () => {
			const out = await execute();
			if (extras?.wrapRunResult === true && isActionResult(out)) return out;
			return out;
		},
		onGuardError: policy.onGuardError ?? "deny"
	});
}
//#endregion
export { guardTool };
