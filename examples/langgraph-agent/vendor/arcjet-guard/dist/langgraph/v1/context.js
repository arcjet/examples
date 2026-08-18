import { shouldWarn } from "../../agents/capture.js";
import { correlationIdProblem } from "../../agents/context.js";
//#region src/langgraph/v1/context.ts
function asContextSource(source) {
	if (source === void 0 || source === null || typeof source !== "object") return;
	return source;
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
function firstString(values) {
	for (const value of values) if (typeof value === "string" && value.length > 0) return value;
}
function readConfigurable(source) {
	if (source === void 0) return;
	if (source.configurable !== null && typeof source.configurable === "object") return source.configurable;
	if (source.config?.configurable !== null && typeof source.config?.configurable === "object") return source.config.configurable;
	if (source.thread_id !== void 0 || source.checkpoint_ns !== void 0) {
		const configurable = {};
		if (source.thread_id !== void 0) configurable["thread_id"] = source.thread_id;
		if (source.checkpoint_ns !== void 0) configurable["checkpoint_ns"] = source.checkpoint_ns;
		return configurable;
	}
}
/**
* Derive correlation and metadata from a LangGraph `RunnableConfig` /
* `ToolRuntime`. Never mints a new id. Never calls `createAgentContext`.
*
* Preference order for `correlationId`:
* 1. `configurable.thread_id` — the checkpointer thread, what the graph
*    already has
* 2. `runId` / `configurable.run_id` — only if the graph already set one
* 3. `configurable.checkpoint_ns` — subgraph namespace, a last resort
*    (`""` for the parent graph is skipped as empty)
*
* An invalid candidate is skipped (and warned when `ARCJET_LOG_LEVEL` asks
* for warnings). If nothing valid remains, `correlationId` is omitted so the
* decision is uncorrelated rather than joined to a generated id nobody has.
*
* @example
* ```ts
* import { langgraphAgentContext } from "@arcjet/guard/langgraph/v1";
*
* export function fromConfig(config: { configurable?: { thread_id?: string } }) {
*   return langgraphAgentContext(config);
* }
* ```
*/
function langgraphAgentContext(source, init) {
	const ctx = asContextSource(source);
	const configurable = readConfigurable(ctx);
	const threadId = configurable?.["thread_id"];
	const checkpointNs = configurable?.["checkpoint_ns"];
	const runId = ctx?.runId ?? ctx?.config?.runId ?? configurable?.["run_id"];
	const { id: correlationId, rejected } = firstValidId([
		{
			value: threadId,
			label: "thread_id"
		},
		{
			value: runId,
			label: "run id"
		},
		{
			value: checkpointNs,
			label: "checkpoint_ns"
		}
	]);
	if (rejected !== void 0 && correlationId === void 0 && shouldWarn()) console.warn(`@arcjet/guard: LangGraph ${rejected} rejected; no valid thread/checkpoint/run id, leaving the call uncorrelated`);
	const derivedMetadata = {};
	const thread = firstString([threadId]);
	if (thread !== void 0) derivedMetadata["langgraph.thread"] = thread;
	const namespace = firstString([checkpointNs]);
	if (namespace !== void 0) derivedMetadata["langgraph.checkpoint_ns"] = namespace;
	const run = firstString([runId]);
	if (run !== void 0) derivedMetadata["langgraph.run"] = run;
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
export { langgraphAgentContext };
