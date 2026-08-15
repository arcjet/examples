import { shouldWarn } from "../../agents/capture.js";
import { ulid } from "../../agents/ulid.js";
import { correlationIdProblem } from "../../agents/context.js";
//#region src/vercel-eve/v0/context.ts
/**
* Derive an ArcjetAgentContext from an Eve SessionContext.
*
* Reads the session ID and auth principal from Eve's context, validates the
* session ID without throwing (delegating to a fallback ULID on failure),
* and packages the result as an ArcjetAgentContext suitable for guard calls.
*
* For delegated sessions (when `session.parent` is present), the correlation
* ID is the **root** session ID, so all decisions in a conversation chain land
* on the user-facing session's Sequence rather than a Sequence nobody reads.
*
* @example
* ```ts
* import { launchArcjet, detectPromptInjection } from "@arcjet/guard";
* import { ArcjetDeniedError, guardAction, eveAgentContext } from "@arcjet/guard/vercel-eve/v0";
* import type { SessionContext } from "eve/context";
*
* const client = launchArcjet({ key: process.env["ARCJET_KEY"]! });
*
* export async function modelResponse(
*   ctx: SessionContext,
*   userMessage: string,
*   model: { invoke(message: string): Promise<string> },
* ): Promise<{ message: string } | { error: string }> {
*   // Thread Eve's session context into the guard as an ArcjetAgentContext,
*   // so the decision lands on the conversation's Sequence.
*   const agentCtx = eveAgentContext(ctx);
*
*   try {
*     const message = await guardAction(
*       client,
*       agentCtx,
*       {
*         action: "model.responded",
*         onGuardError: "deny", // default — blocks the call if Arcjet is unreachable
*         rules: [detectPromptInjection()(userMessage)],
*       },
*       () => model.invoke(userMessage),
*     );
*     return { message };
*   } catch (error) {
*     if (error instanceof ArcjetDeniedError) {
*       return { error: "Request blocked by security policy" };
*     }
*     throw error;
*   }
* }
* ```
*
* @param ctx - Eve's SessionContext, carrying the session ID, auth principal, and turn
* @param init - Optional initialization object with metadata
* @returns An ArcjetAgentContext suitable for passing to guard
*/
function eveAgentContext(ctx, init) {
	let correlationId = ctx?.session?.parent?.rootSessionId ?? ctx?.session?.id;
	if (typeof correlationId === "string") {
		const problem = correlationIdProblem(correlationId);
		if (problem !== void 0) {
			if (shouldWarn()) console.warn(`@arcjet/guard: session id rejected (${problem}), using generated ULID`);
			correlationId = ulid();
		}
	} else correlationId = ulid();
	const derivedMetadata = {};
	const rawSessionId = ctx?.session?.id;
	if (typeof rawSessionId === "string") derivedMetadata["eve.session"] = rawSessionId;
	const turnId = ctx?.session?.turn?.id;
	if (typeof turnId === "string" && turnId.length > 0) derivedMetadata["eve.turn"] = turnId;
	const parentSessionId = ctx?.session?.parent?.sessionId;
	if (typeof parentSessionId === "string") derivedMetadata["eve.parent-session"] = parentSessionId;
	const principalId = ctx?.session?.auth?.current?.principalId;
	if (typeof principalId === "string" && principalId.length > 0) derivedMetadata["user"] = principalId;
	const metadata = {
		...derivedMetadata,
		...init?.metadata
	};
	const result = { correlationId };
	if (Object.keys(metadata).length > 0) result.metadata = metadata;
	return result;
}
//#endregion
export { eveAgentContext };
