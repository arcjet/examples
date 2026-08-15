import { captureEvent, shouldWarn } from "../../agents/capture.js";
//#region src/vercel-eve/v0/gate.ts
/**
* The guard → capture sequence for a call site that decides whether something
* may run but does not run it. This is the gate engine shared by all Eve
* approval enforcement (tools, OpenAPI connections, MCP connections).
*
* Unlike `runGuarded`, which also executes and captures execution outcomes:
* - There is no execute. The allow tail returns immediately. Nothing here can
*   produce `"success"` or `"error"` — a gate that passed has not done the thing.
* - The allow outcome is `"allowed"`, not `"success"` — a distinction that
*   keeps "the tool ran" and "the tool was permitted to run" separate on the
*   capture stream.
*
* Contract:
*
* 1. `onGuardError` defaults to `"deny"`.
* 2. Build `correlation` as `correlationId === undefined ? {} : { correlationId }` —
*    the field is optional under `exactOptionalPropertyTypes`, so assigning
*    `undefined` is a type error.
* 3. Call `client.guard()` inside a `try`. Always call it, including with no rules.
* 4. On throw: if failing closed, warn, capture with `outcome: "unavailable"`,
*    return `onUnavailable({ kind: "threw", error })`. If failing open, warn
*    and fall through to the allow tail.
* 5. Suppress `decision.id === ""` — a fail-open decision carries an empty id
*    and `""` is not a correlatable value.
* 6. If ALLOW with failed-open and failing closed: warn, capture `"unavailable"`,
*    `onUnavailable({ kind: "failed-open", decision })`. Keep the conjunction
*    inside the single `if`: TypeScript cannot narrow on a method return.
* 7. If ALLOW with failed-open and failing open: warn, fall through.
* 8. If DENY: capture `"denied"`, return `onDeny(decision)`.
* 9. Allow tail: capture `"allowed"`, return `onAllow()`.
*
* Every capture goes through `captureEvent`, which swallows throws.
*/
async function runGate(client, params) {
	const { action, rules, correlationId, metadata, onAllow, onDeny, onUnavailable, onGuardError = "deny" } = params;
	const correlation = correlationId === void 0 ? {} : { correlationId };
	const failClosed = onGuardError === "deny";
	let decisionId;
	let decision;
	try {
		decision = await client.guard({
			label: action,
			rules: rules ?? [],
			...correlation,
			metadata
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
	captureEvent(client, {
		action,
		...correlation,
		...decisionId !== void 0 && { decisionId },
		metadata: {
			...metadata,
			outcome: "allowed"
		}
	});
	return onAllow();
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
export { runGate };
