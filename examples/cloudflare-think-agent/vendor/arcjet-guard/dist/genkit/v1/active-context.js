//#region src/genkit/v1/active-context.ts
/**
* The generate() context Genkit stores in async-local storage. Authored
* tool handlers see it on `{ context }` even when the ToolAction call's
* `options` omit it — `generate({ context })` does not copy that object
* onto the tool invocation.
*
* Dynamic import so this namespace stays loadable when the optional
* `genkit` peer is absent. Construction only runs on a live tool call,
* which is only reachable in an app that already installed Genkit.
*/
let loadedGetContext;
let loadFailed = false;
async function readActiveContext() {
	if (loadFailed) return;
	if (loadedGetContext === void 0) try {
		const core = await import("../../node_modules/@genkit-ai/core/lib/index.js");
		if (typeof core.getContext !== "function") {
			loadFailed = true;
			return;
		}
		loadedGetContext = core.getContext;
	} catch {
		loadFailed = true;
		return;
	}
	try {
		return loadedGetContext();
	} catch {
		return;
	}
}
function hasOwnContext(value) {
	if (value === null || typeof value !== "object" || !("context" in value)) return false;
	const context = value.context;
	return context !== void 0 && context !== null;
}
/**
* Attach the ALS generate context onto a tool-call options / middleware
* `ctx` object when that object does not already carry `context`.
*/
async function withActiveGenkitContext(options) {
	if (hasOwnContext(options)) return options;
	const active = await readActiveContext();
	if (active === void 0) return options;
	if (options !== null && typeof options === "object") return {
		...options,
		context: active
	};
	return { context: active };
}
//#endregion
export { withActiveGenkitContext };
