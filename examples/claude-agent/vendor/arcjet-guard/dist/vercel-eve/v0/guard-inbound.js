import { deniedReason, unavailableReason } from "./denial.js";
import { runGate } from "./gate.js";
//#region src/vercel-eve/v0/guard-inbound.ts
/**
* Screen inbound text at the channel boundary using Arcjet guard policies.
*
* Returns a verdict indicating whether the text passed screening. Never throws,
* even if the guard call fails, a rule throws, or capture fails — returns an
* appropriate verdict based on `onGuardError`.
*
* The channel boundary runs before Eve creates the session, so:
* - There is no session id to derive from: pass the identity the channel has
* - The verdict is a simple pass/fail, not tied to a user-facing approval flow
* - `correlationId` must be provided by the caller if correlation is needed
*
* @example
* ```ts
* import {
*   launchArcjet,
*   detectPromptInjection,
*   localDetectSensitiveInfo,
* } from "@arcjet/guard";
* import { guardInbound } from "@arcjet/guard/vercel-eve/v0";
*
* const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
*
* // A channel handler runs before Eve creates the session, so the identity it
* // passes is the one the channel already has — here a Slack thread timestamp.
* // `arcjetHooks` emits a join record at `session.started` tying it to the
* // session id.
* export async function onInboundMessage(
*   text: string,
*   threadTs: string,
* ): Promise<string | undefined> {
*   // Build rules from the text and pass the same text; the helper never
*   // inspects it, and it is deliberately kept out of metadata.
*   const verdict = await guardInbound(arcjet, text, {
*     rules: [detectPromptInjection()(text), localDetectSensitiveInfo()(text)],
*     correlationId: threadTs,
*   });
*
*   if (!verdict.allowed) {
*     // `verdict.reason` distinguishes a policy denial from an Arcjet outage,
*     // and on a DENY `verdict.decision` is the real decision, so a rule's own
*     // `results()` can classify it further.
*     return `Your message was not processed: ${verdict.message}`;
*   }
*
*   // Screening passed; hand the turn to the agent.
*   return undefined;
* }
* ```
*
* @param client - Arcjet guard client
* @param text - Inbound text to screen (not placed in metadata)
* @param options - Screening policy
* @returns A verdict: `{ allowed: true }` or `{ allowed: false, reason, message, decision? }`
*/
async function guardInbound(client, text, options) {
	const action = options.action ?? "message.received";
	try {
		const metadata = {
			"eve.phase": "inbound",
			...options.metadata
		};
		return await runGate(client, {
			action,
			rules: options.rules,
			correlationId: options.correlationId,
			metadata,
			onAllow: () => ({ allowed: true }),
			onDeny: (decision) => ({
				allowed: false,
				reason: "DENY",
				decision,
				message: deniedReason(decision)
			}),
			onUnavailable: () => ({
				allowed: false,
				reason: "UNAVAILABLE",
				message: unavailableReason()
			}),
			onGuardError: options.onGuardError ?? "deny"
		});
	} catch {
		return options.onGuardError !== "allow" ? {
			allowed: false,
			reason: "UNAVAILABLE",
			message: unavailableReason()
		} : { allowed: true };
	}
}
//#endregion
export { guardInbound };
