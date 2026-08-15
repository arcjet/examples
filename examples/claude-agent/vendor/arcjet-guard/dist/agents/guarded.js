import { captureEvent, shouldWarn } from "./capture.js";
//#region src/agents/guarded.ts
/**
* The guard → deny → execute → capture sequence shared by `guardTool()` and
* `guardAction()`. Callers resolve `rules`, `metadata`, and `correlationId`
* (including any per-input functions and overrides) and pass the final values;
* this runs the common flow:
*
* 1. Call `guard()` — always, including when `rules` is omitted or empty, which
*    is sent as `[]`. Both guard-unavailable signals (threw and failed-open)
*    are governed by `onGuardError`: with `"deny"` (the default), both trigger
*    `onUnavailable` without executing; with `"allow"`, both fail open and
*    proceed to execute.
* 2. On DENY, capture `outcome: "denied"` and return `onDeny(decision)`.
* 3. Otherwise run `execute()`, capturing `outcome: "success"` — or, if it
*    throws, `outcome: "error"` before rethrowing.
*
* `onDeny` returns the value the caller hands back on denial (`guardTool`
* returns an `ArcjetDenialResult`; `guardAction` throws, and its `never`
* return type is assignable to `T`).
*/
async function runGuarded(client, params) {
	const { action, rules, correlationId, metadata, actor, inputs, resolvePolicy, onDeny, onUnavailable, execute, onGuardError = "deny" } = params;
	const correlation = correlationId === void 0 ? {} : { correlationId };
	const failClosed = onGuardError === "deny";
	let decisionId;
	let decision;
	try {
		const resolved = resolvePolicy === void 0 ? {
			actor,
			inputs
		} : await resolvePolicy();
		decision = await client.guard({
			label: action,
			rules: rules ?? [],
			...correlation,
			metadata,
			...resolved.actor !== void 0 && { actor: resolved.actor },
			...resolved.inputs !== void 0 && { inputs: resolved.inputs }
		});
	} catch (error) {
		if (failClosed) {
			warnUnavailable(action, "threw", true, error);
			captureEvent(client, {
				action,
				...correlation,
				metadata: {
					...metadata,
					outcome: "unavailable"
				}
			});
			return onUnavailable({
				kind: "threw",
				error
			});
		}
		warnUnavailable(action, "threw", false, error);
		decision = void 0;
	}
	if (decision !== void 0) {
		if (decision.id !== "") decisionId = decision.id;
		if (decision.conclusion === "ALLOW" && decision.hasFailedOpen() && failClosed) {
			warnUnavailable(action, "failed-open", true);
			captureEvent(client, {
				action,
				...correlation,
				...decisionId !== void 0 && { decisionId },
				metadata: {
					...metadata,
					outcome: "unavailable"
				}
			});
			return onUnavailable({
				kind: "failed-open",
				decision
			});
		}
		if (decision.conclusion === "ALLOW" && decision.hasFailedOpen()) warnUnavailable(action, "failed-open", false);
		if (decision.conclusion === "DENY") {
			captureEvent(client, {
				action,
				...correlation,
				...decisionId !== void 0 && { decisionId },
				metadata: {
					...metadata,
					outcome: "denied"
				}
			});
			return onDeny(decision);
		}
	}
	let result;
	try {
		result = await execute();
	} catch (error) {
		captureEvent(client, {
			action,
			...correlation,
			...decisionId !== void 0 && { decisionId },
			metadata: {
				...metadata,
				outcome: "error"
			}
		});
		throw error;
	}
	captureEvent(client, {
		action,
		...correlation,
		...decisionId !== void 0 && { decisionId },
		metadata: {
			...metadata,
			outcome: "success"
		}
	});
	return result;
}
function warnUnavailable(action, signal, failClosed, error) {
	if (!shouldWarn()) return;
	if (signal === "threw") {
		if (failClosed) console.warn("@arcjet/guard: guard check for \"%s\" errored; failing closed:", action, error);
		else console.warn("@arcjet/guard: guard check for \"%s\" errored; failing open:", action, error);
		return;
	}
	if (failClosed) console.warn("@arcjet/guard: guard check for \"%s\" was unavailable; failing closed.", action);
	else console.warn("@arcjet/guard: guard check for \"%s\" failed open (API error).", action);
}
//#endregion
export { runGuarded };
