import { assertValidAction } from "../../agents/label.js";
import { resolveActorInputs } from "../../agents/actor-inputs.js";
import { shouldWarn } from "../../agents/capture.js";
import { denialResult, unavailableResult } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { withActiveGenkitContext } from "./active-context.js";
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
		if (shouldWarn()) console.warn("@arcjet/guard: guardTool() for \"%s\" was invoked with a string input that is not JSON, so no arguments were scanned.", action);
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
* The registry map `defineTool` registered this action in, when the
* action came from `defineTool` rather than `dynamicTool` / `tool()`.
*/
function registryStore(tool) {
	const registry = "__registry" in tool ? tool.__registry : void 0;
	if (registry === null || typeof registry !== "object") return;
	if (!("actionsById" in registry)) return;
	const store = registry.actionsById;
	if (store === null || typeof store !== "object") return;
	return store;
}
/**
* Every registry key that can resolve to `tool`'s authored handler.
*
* `defineTool(config, fn)` registers *two* actions for a non-multipart
* tool: the returned action under `/tool/<name>`, and a second
* `basicToolV2(config, fn)` twin under `/tool.v2/<name>` that closes
* over the same `fn`. Guarding only the first leaves a live unguarded
* reference to the handler on the registry.
*/
function registryKeys(tool) {
	const { key, actionType, name } = tool.__action ?? {};
	const keys = /* @__PURE__ */ new Set();
	if (typeof key === "string") keys.add(key);
	if (typeof name === "string") {
		if (typeof actionType === "string") keys.add(`/${actionType}/${name}`);
		keys.add(`/tool/${name}`);
		keys.add(`/tool.v2/${name}`);
	}
	return [...keys];
}
/**
* `ai.generate({ tools })` does not keep the ToolAction objects. It
* converts them to name/schema definitions (`toToolDefinition`) and
* `resolveTools` looks the live action up on the registry. A wrapper
* that is only a copy would be discarded; the original registered
* action would run unguarded. Overwrite every registry entry that
* resolves to the authored handler so generate() resolves a guarded
* callable. Dynamic tools (`metadata.dynamic`) are registered from the
* `tools` array at generate() time and do not need this.
*
* The `/tool.v2/<name>` twin is a different action object wrapping the
* same handler, so it is guarded with its own wrapper — passing the
* basic wrapper would change the multipart response shape
* `executeTool` expects from a `tool.v2` action.
*/
function reregisterGuardedTool(original, wrapped, wrapTwin) {
	const store = registryStore(original);
	if (store === void 0) return;
	for (const candidate of registryKeys(original)) {
		if (!Object.hasOwn(store, candidate)) continue;
		const current = Reflect.get(store, candidate);
		if (current === original) {
			install(store, candidate, wrapped);
			continue;
		}
		if (typeof current === "function" && !(arcjetProtectedTool in current)) install(store, candidate, wrapTwin(current));
	}
}
/**
* Replace one registry entry, or fail loudly.
*
* A frozen or otherwise non-writable entry makes `Reflect.set` return
* `false` rather than throw, and generate() would then resolve the
* unguarded original. Silently handing back a wrapper that the runner
* never calls is the one outcome a security wrapper must not have, so
* this fails at wrap time — the same choice `guardToolNode` makes for a
* frozen `ToolNode.tools` array.
*/
function install(store, key, action) {
	if (Reflect.set(store, key, action)) return;
	throw new Error(`@arcjet/guard: guardTool() could not replace the registry entry for "${key}"; generate() would run the tool unguarded. Guard the tool before it is registered, or unfreeze the Genkit registry.`);
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
* therefore overwrites the registry entries so generate() cannot run
* the unguarded `defineTool` action — including the `/tool.v2/<name>`
* twin `defineTool` registers alongside a basic tool, which closes over
* the same handler. Dynamic tools are registered from the `tools` array
* at generate() time and do not need that.
*
* A `multipart: true` tool resolves to `{ output, content }` and
* `executeTool` reads `.output`; denials from one are returned in that
* shape so the model still sees the explanation.
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
	assertValidAction(policy.action, "guardTool");
	if (typeof tool !== "function") throw new Error("@arcjet/guard: guardTool() requires a ToolAction from defineTool() (a callable). Pass the result of ai.defineTool(config, handler), not the config object.");
	if (arcjetProtectedTool in tool) throw new Error("@arcjet/guard: guardTool() cannot wrap a tool that is already guarded; do not double-wrap with @arcjet/guard/genkit/v1 or @arcjet/guard/vercel-ai/v7");
	const wrapped = wrapToolAction(client, tool, policy);
	reregisterGuardedTool(tool, wrapped, (twin) => wrapToolAction(client, twin, policy));
	return wrapped;
}
/**
* The wrap itself, without the registry replacement: replaces the
* callable and `.run` with guarded ones and brands the result.
*/
function wrapToolAction(client, tool, policy) {
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
	return wrapped;
}
/**
* Shape a denial the way the action the wrapper replaced would have
* returned it.
*
* A `tool.v2` (multipart) action resolves to
* `{ output, content, metadata }`, and `executeTool` reads `.output`
* off it — returning a bare denial from one puts `undefined` on
* `toolResponse.output` and the model is told nothing. `.run()` adds
* the `{ result, telemetry }` envelope on top of either shape.
*/
function denialEnvelope(value, extras) {
	const shaped = extras.multipart ? { output: value } : value;
	return extras.wrapRunResult ? {
		result: shaped,
		telemetry: {
			traceId: "",
			spanId: ""
		}
	} : shaped;
}
async function runGuardedTool(client, tool, policy, input, options, execute, extras) {
	const args = toolArgs(input, policy.action);
	const envelope = {
		multipart: tool.__action?.actionType === "tool.v2",
		wrapRunResult: extras?.wrapRunResult === true
	};
	let sessionId;
	let rules;
	let policyMetadata;
	let remote = {};
	let callOptions;
	try {
		const typedArgs = args;
		sessionId = resolveSessionId(policy, typedArgs);
		rules = typeof policy.rules === "function" ? policy.rules(typedArgs) : policy.rules;
		policyMetadata = typeof policy.metadata === "function" ? policy.metadata(typedArgs) : policy.metadata;
		callOptions = await withActiveGenkitContext(options);
		remote = await resolveActorInputs(policy, typedArgs, callOptions);
	} catch (error) {
		if (shouldWarn()) console.warn("@arcjet/guard: policy factory for \"%s\" threw; treating as a guard error:", policy.action, error);
		if (policy.onGuardError === "allow") return execute();
		return denialEnvelope(unavailableResult(), envelope);
	}
	const source = isContextSource(callOptions) ? callOptions : void 0;
	const agentCtx = genkitContext(source, sessionId === void 0 ? void 0 : { sessionId });
	const toolName = typeof tool.__action?.name === "string" && tool.__action.name.length > 0 ? tool.__action.name : void 0;
	const mergedMetadata = {
		...agentCtx.metadata,
		...toolName !== void 0 && { "genkit.tool": toolName },
		...policyMetadata
	};
	const asResult = (value) => denialEnvelope(value, envelope);
	return runGuarded(client, {
		action: policy.action,
		rules,
		correlationId: agentCtx.correlationId,
		metadata: mergedMetadata,
		...remote,
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
		execute,
		onGuardError: policy.onGuardError ?? "deny"
	});
}
//#endregion
export { guardTool };
