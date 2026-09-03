import { deniedReason, unavailableReason } from "../../agents/denial.js";
import { runGate } from "./gate.js";
import { inboundTextFromEvents, isUserMessageEvent } from "./types.js";
//#region src/claude-managed-agents/v0/guard-events.ts
/**
* Gate `user.message` / `initial_events` **before** `sessions.events.send`.
*
* Anthropic runs the hosted tool loop. There is no PreToolUse. This helper
* screens the text the app is about to send; on DENY (or a fail-closed
* outage) `send` is not called.
*
* Events that are not `user.message` (interrupt, custom_tool_result, …)
* pass through without an inbound screen — they are not a user turn.
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
	if (!events.some((event) => isUserMessageEvent(event))) return {
		allowed: true,
		sent: await send({ events })
	};
	const text = inboundTextFromEvents(events);
	const action = policy.inbound.action ?? "message.received";
	let rules;
	try {
		rules = typeof policy.inbound.rules === "function" ? policy.inbound.rules({
			text,
			events
		}) : policy.inbound.rules;
	} catch (error) {
		if (policy.inbound.onGuardError === "allow") return {
			allowed: true,
			sent: await send({ events })
		};
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
	if (!verdict.allowed) return verdict;
	return {
		allowed: true,
		sent: await send({ events })
	};
}
//#endregion
export { guardEvents };
