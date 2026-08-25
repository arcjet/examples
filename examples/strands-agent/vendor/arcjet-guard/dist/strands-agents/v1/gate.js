import { captureEvent, shouldWarn } from "../../agents/capture.js";
//#region src/strands-agents/v1/gate.ts
/**
* The guard → capture sequence for a call site that decides whether something
* may run but does not run it. Shared by `guardHooks` on
* `BeforeToolCallEvent`.
*
* The allow outcome is `"allowed"`, not `"success"` — a distinction that
* keeps "the tool ran" and "the tool was permitted to run" separate.
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
