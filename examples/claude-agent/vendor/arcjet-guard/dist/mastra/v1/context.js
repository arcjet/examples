import { shouldWarn } from "../../agents/capture.js";
import { correlationIdProblem } from "../../agents/context.js";
//#region src/mastra/v1/context.ts
/**
* Reserved RequestContext keys from `@mastra/core`. Hardcoded so this module
* never value-imports Mastra — CI must pass with `@mastra/core` absent from
* `node_modules`.
*
* @see https://mastra.ai/docs/server/request-context
*/
const MASTRA_THREAD_ID_KEY = "mastra__threadId";
const MASTRA_RESOURCE_ID_KEY = "mastra__resourceId";
function isRequestContextLike(value) {
	return value !== null && typeof value === "object" && "get" in value && typeof value.get === "function";
}
function asContextSource(source) {
	if (source === void 0 || source === null) return;
	if (isRequestContextLike(source)) return { requestContext: source };
	if (typeof source === "object") return source;
}
function readContextValue(requestContext, key) {
	if (requestContext === void 0) return;
	try {
		return requestContext.get(key);
	} catch {
		return;
	}
}
function firstValidId(candidates) {
	let rejected;
	for (const candidate of candidates) {
		if (typeof candidate.value !== "string") continue;
		const problem = correlationIdProblem(candidate.value);
		if (problem === void 0) return {
			id: candidate.value,
			rejected: void 0
		};
		rejected = `${candidate.label} (${problem})`;
	}
	return {
		id: void 0,
		rejected
	};
}
/**
* Derive correlation and metadata from a Mastra RequestContext or execution
* context. Never mints a new id.
*
* Preference order for `correlationId`:
* 1. `MASTRA_THREAD_ID_KEY` (`mastra__threadId`), then `agent.threadId`
* 2. `MASTRA_RESOURCE_ID_KEY` (`mastra__resourceId`), then `agent.resourceId`
* 3. `workflow.runId`
*
* An invalid candidate is skipped (and warned when `ARCJET_LOG_LEVEL` asks
* for warnings). If nothing valid remains, `correlationId` is omitted so the
* decision is uncorrelated rather than joined to a generated id nobody has.
*
* @example
* ```ts
* import { mastraAgentContext } from "@arcjet/guard/mastra/v1";
* import type { RequestContext } from "@mastra/core/request-context";
*
* export function fromRequest(requestContext: RequestContext) {
*   return mastraAgentContext(requestContext);
* }
* ```
*/
function mastraAgentContext(source, init) {
	const ctx = asContextSource(source);
	const requestContext = ctx?.requestContext;
	const threadFromKey = readContextValue(requestContext, MASTRA_THREAD_ID_KEY);
	const resourceFromKey = readContextValue(requestContext, MASTRA_RESOURCE_ID_KEY);
	const threadFromAgent = ctx?.agent?.threadId;
	const resourceFromAgent = ctx?.agent?.resourceId;
	const runFromWorkflow = ctx?.workflow?.runId;
	const { id: correlationId, rejected } = firstValidId([
		{
			value: threadFromKey,
			label: "thread id"
		},
		{
			value: threadFromAgent,
			label: "agent.threadId"
		},
		{
			value: resourceFromKey,
			label: "resource id"
		},
		{
			value: resourceFromAgent,
			label: "agent.resourceId"
		},
		{
			value: runFromWorkflow,
			label: "workflow.runId"
		}
	]);
	if (rejected !== void 0 && correlationId === void 0 && shouldWarn()) console.warn(`@arcjet/guard: Mastra ${rejected} rejected; no valid thread/resource/run id, leaving the call uncorrelated`);
	const derivedMetadata = {};
	if (typeof threadFromKey === "string" && threadFromKey.length > 0) derivedMetadata["mastra.thread"] = threadFromKey;
	else if (typeof threadFromAgent === "string" && threadFromAgent.length > 0) derivedMetadata["mastra.thread"] = threadFromAgent;
	if (typeof resourceFromKey === "string" && resourceFromKey.length > 0) derivedMetadata["mastra.resource"] = resourceFromKey;
	else if (typeof resourceFromAgent === "string" && resourceFromAgent.length > 0) derivedMetadata["mastra.resource"] = resourceFromAgent;
	if (typeof runFromWorkflow === "string" && runFromWorkflow.length > 0) derivedMetadata["mastra.run"] = runFromWorkflow;
	const user = (typeof resourceFromKey === "string" && resourceFromKey.length > 0 ? resourceFromKey : void 0) ?? (typeof resourceFromAgent === "string" && resourceFromAgent.length > 0 ? resourceFromAgent : void 0);
	if (user !== void 0) derivedMetadata["user"] = user;
	const metadata = {
		...derivedMetadata,
		...init?.metadata
	};
	const result = {};
	if (correlationId !== void 0) result.correlationId = correlationId;
	if (Object.keys(metadata).length > 0) result.metadata = metadata;
	return result;
}
//#endregion
export { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, mastraAgentContext };
