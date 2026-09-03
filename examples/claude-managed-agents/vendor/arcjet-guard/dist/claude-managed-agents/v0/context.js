import { shouldWarn } from "../../agents/capture.js";
import { correlationIdProblem } from "../../agents/context.js";
//#region src/claude-managed-agents/v0/context.ts
/**
* Build correlation from a caller-owned id only.
*
* Preference: `init.correlationId` when it is a valid 1–256 printable-ASCII
* string. An invalid value is dropped (and warned when `ARCJET_LOG_LEVEL`
* asks for warnings). Anthropic session / event ids passed on any other
* field are ignored. `traceId` is never read or written.
*
* @example
* ```ts
* import { claudeManagedAgentsContext } from "@arcjet/guard/claude-managed-agents/v0";
*
* // Conversation id the app minted — not session.id from Anthropic.
* const ctx = claudeManagedAgentsContext({ correlationId: conversationId });
* ```
*/
function claudeManagedAgentsContext(init) {
	const result = {};
	const candidate = init?.correlationId;
	if (candidate !== void 0) {
		const problem = correlationIdProblem(candidate);
		if (problem === void 0) result.correlationId = candidate;
		else if (shouldWarn()) console.warn(`@arcjet/guard: Claude Managed Agents correlationId rejected (${problem}); leaving the call uncorrelated`);
	}
	if (init?.metadata !== void 0 && Object.keys(init.metadata).length > 0) result.metadata = { ...init.metadata };
	return result;
}
//#endregion
export { claudeManagedAgentsContext };
