import { arcjetProtectedTool } from "../../agents/internal.js";
//#region src/vercel-ai/v7/tools-context.ts
/**
* Extract context for tools protected by Arcjet.
*
* Maps an ArcjetAgentContext to a `toolsContext` object suitable for the
* Vercel AI SDK's `generateText()` call. Only tools bearing the
* `arcjetProtectedTool` brand are included in the result; unbranded tools
* are omitted (this preserves type safety at the AI SDK call site).
*
* @param ctx - The security context to thread through
* @param tools - The ToolSet passed to generateText
* @returns A context map keyed by tool name, containing only protected tools
*
* @example
* ```ts
* import { launchArcjet, tokenBucket } from "@arcjet/guard";
* import { createAgentContext, guardTool, aiToolsContext } from "@arcjet/guard/vercel-ai/v7";
* import { tool, generateText } from "ai";
*
* const arcjetClient = launchArcjet({ key: process.env.ARCJET_KEY! });
* const ctx = createAgentContext();
* const emailLimit = tokenBucket({ refillRate: 5, intervalSeconds: 60, maxTokens: 5 });
* const protectedTools = {
*   sendEmail: guardTool(arcjetClient, sendEmailTool, {
*     action: "email.sent",
*     onGuardError: "deny", // default — blocks the call if Arcjet is unreachable
*     rules: [emailLimit({ key: userId, requested: 1 })],
*   }),
* };
* const result = await generateText({
*   model: languageModel,
*   tools: protectedTools,
*   toolsContext: aiToolsContext(ctx, protectedTools),
*   messages: [{ role: "user", content: "Send confirmation" }],
* });
* ```
*/
function aiToolsContext(ctx, tools) {
	const result = {};
	for (const [name, tool] of Object.entries(tools)) if (arcjetProtectedTool in tool) result[name] = ctx;
	return result;
}
//#endregion
export { aiToolsContext };
