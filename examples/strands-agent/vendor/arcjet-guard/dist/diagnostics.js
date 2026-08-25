import { Logger } from "@arcjet/logger";
//#region src/diagnostics.ts
/**
* Where a client keeps its diagnostics channel so the registry can reach it.
*
* A client's logger is captured inside `createGuardClient` and appears nowhere
* on the public `ArcjetGuard` surface. Registration needs it anyway: when a
* second client tries to register, the warning belongs to the application that
* registered *first*, on the logger it configured — not on whatever sink the
* late registrant brought with it.
*
* A symbol rather than a property so it stays invisible to `Object.keys` and
* cannot collide with anything on a caller-supplied object.
*
* @internal
*/
const symbolArcjetDiagnostics = Symbol.for("arcjet.guard.diagnostics");
const DEFAULT_COALESCE_MS = 6e4;
/**
* Build the diagnostics channel for one client.
*
* Diagnostics go through `@arcjet/logger`, so they are formatted and level-gated
* like every other Arcjet log line rather than written straight to the console.
*
* A caller-supplied logger receives every diagnostic, because the caller already
* controls filtering — anything keeping a metric of dropped events needs all of
* them. The default logger coalesces instead: `capture()` is called on a request
* path, so a persistent problem — a full queue under load, an unreachable API —
* would otherwise emit a line per event and turn a best-effort telemetry drop
* into a logging incident.
*
* Coalescing reports a code at most once per quiet period and **accumulates the
* counts in between**, releasing them with the next line for that code or from
* {@link CoalescingDiagnosticHandler.drain}, which `flush()` calls. Suppressing
* without accumulating is the trap here: reporting only the first event of a
* thousand-drop burst understates it by three orders of magnitude, which is what
* this used to do.
*
* A burst that ends with neither a later drop nor a `flush()` still
* under-reports. That is the residual cost of bounding log volume, and it is why
* the figure is a count of events seen rather than a guaranteed total.
*/
function createDiagnosticHandler(options = {}) {
	const { logger } = options;
	const now = options.now ?? Date.now;
	const coalesceMs = logger === void 0 ? options.coalesceMs ?? DEFAULT_COALESCE_MS : 0;
	const suppressed = /* @__PURE__ */ new Map();
	const lastLogged = /* @__PURE__ */ new Map();
	let sink = logger;
	function emit(code, message, count) {
		sink ??= new Logger({ level: "warn" });
		sink.warn({
			code,
			...count === void 0 ? {} : { count }
		}, message);
	}
	function diagnose(diagnostic) {
		try {
			const held = suppressed.get(diagnostic.code);
			suppressed.delete(diagnostic.code);
			const total = held === void 0 && diagnostic.count === void 0 ? void 0 : (held?.count ?? 0) + (diagnostic.count ?? 1);
			const at = now();
			const previous = lastLogged.get(diagnostic.code);
			if (coalesceMs > 0 && previous !== void 0 && at - previous < coalesceMs) {
				suppressed.set(diagnostic.code, {
					count: total ?? 1,
					message: diagnostic.message
				});
				return;
			}
			lastLogged.set(diagnostic.code, at);
			emit(diagnostic.code, diagnostic.message, total);
		} catch {}
	}
	diagnose.drain = function drain() {
		try {
			for (const [code, held] of suppressed) {
				suppressed.delete(code);
				if (held.count > 0) {
					lastLogged.set(code, now());
					emit(code, held.message, held.count);
				}
			}
		} catch {}
	};
	return diagnose;
}
//#endregion
export { createDiagnosticHandler, symbolArcjetDiagnostics };
