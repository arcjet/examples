import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
import { ArcjetAgentContext } from "../../agents/context.js";
import { SessionContext } from "eve/context";
//#region src/vercel-eve/v0/context.d.ts
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
declare function eveAgentContext(ctx: SessionContext, init?: {
  metadata?: ArcjetMetadata;
}): ArcjetAgentContext;
//#endregion
export { eveAgentContext };