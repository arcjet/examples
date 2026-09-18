import { resolveActorInputs } from "../../agents/actor-inputs.js";
import { shouldWarn } from "../../agents/capture.js";
import { deniedReason, unavailableReason } from "../../agents/denial.js";
import { runGate } from "./gate.js";
import { inboundTextFromEvents, isUserMessageEvent } from "./types.js";
//#region src/claude-managed-agents/v0/guard-events.ts
/**
* Gate `user.message` / `initial_events` **before** `sessions.events.send`.
*
* Anthropic runs the hosted tool loop. There is no PreToolUse. This helper
* screens the text the app is about to send; on DENY (or a fail-closed
* outage) `user.message` events are not sent.
*
* Events that are not `user.message` (interrupt, custom_tool_result, …)
* pass through without an inbound screen — they are not a user turn.
* A mixed batch that includes a `user.message` still forwards those
* non-message events when the turn is denied, so a batched
* `user.custom_tool_result` does not leave the session idle.
*
* Default `always_allow` on Anthropic-cloud bash/read/write **cannot** be
* gated here. `web_search` / `web_fetch` always run on Anthropic.
*
* @example
* ```ts
* import { launchArcjet, detectPromptInjection } from "@arcjet/guard";
* import {
*   claudeManagedAgentsContext,
*   guardEvents,
* } from "@arcjet/guard/claude-managed-agents/v0";
*
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
* const events = [
*   { type: "user.message" as const, content: [{ type: "text" as const, text }] },
* ];
*
* const verdict = await guardEvents(
*   arcjet,
*   {
*     events,
*     inbound: {
*       action: "message.received",
*       rules: ({ text }) => [detectPromptInjection()(text)],
*     },
*     context: claudeManagedAgentsContext({ correlationId: conversationId }),
*   },
*   (body) => client.beta.sessions.events.send(session.id, body),
* );
*
* if (!verdict.allowed) {
*   return verdict.message;
* }
* ```
*/
async function guardEvents(client, policy, send) {
	const events = [...policy.events];
	const remainder = events.filter((event) => !isUserMessageEvent(event));
	if (!(remainder.length !== events.length)) return {
		allowed: true,
		sent: await send({ events })
	};
	const text = inboundTextFromEvents(events);
	const action = policy.inbound.action ?? "message.received";
	const inboundArg = {
		text,
		events
	};
	let rules;
	let remote = {};
	try {
		rules = typeof policy.inbound.rules === "function" ? policy.inbound.rules(inboundArg) : policy.inbound.rules;
		remote = await resolveActorInputs(policy.inbound, inboundArg);
	} catch (error) {
		if (shouldWarn()) console.warn("@arcjet/guard: policy factory for \"%s\" threw; treating as a guard error:", action, error);
		if (policy.inbound.onGuardError === "allow") return {
			allowed: true,
			sent: await send({ events })
		};
		await sendRemainder(send, remainder);
		return {
			allowed: false,
			outcome: "UNAVAILABLE",
			message: unavailableReason()
		};
	}
	const metadata = {
		"claude.managed-agents.phase": "inbound",
		...policy.context?.metadata,
		...policy.metadata
	};
	const verdict = await runGate(client, {
		action,
		rules,
		correlationId: policy.context?.correlationId,
		metadata,
		...remote,
		onAllow: () => ({ allowed: true }),
		onDeny: (decision) => ({
			allowed: false,
			outcome: "DENY",
			message: deniedReason(decision),
			decision
		}),
		onUnavailable: () => ({
			allowed: false,
			outcome: "UNAVAILABLE",
			message: unavailableReason()
		}),
		onGuardError: policy.inbound.onGuardError ?? "deny"
	});
	if (!verdict.allowed) {
		await sendRemainder(send, remainder);
		return verdict;
	}
	return {
		allowed: true,
		sent: await send({ events })
	};
}
async function sendRemainder(send, remainder) {
	if (remainder.length === 0) return;
	await send({ events: remainder });
}
//#endregion
export { guardEvents };
