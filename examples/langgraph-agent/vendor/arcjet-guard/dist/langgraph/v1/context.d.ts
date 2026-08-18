import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
//#region src/langgraph/v1/context.d.ts
/**
 * Structural source `langgraphAgentContext` can read. Accepts a LangGraph
 * `RunnableConfig` (`configurable.thread_id`), a `ToolRuntime` (which spreads
 * that config and also nests it on `config`), or the `configurable` object
 * itself.
 *
 * Declared here so this module never value-imports `@langchain/langgraph` or
 * `@langchain/core` — CI must pass with those packages absent from
 * `node_modules`.
 */
interface LangGraphContextSource {
  configurable?: Record<string, unknown>;
  config?: {
    configurable?: Record<string, unknown>;
    runId?: unknown;
    metadata?: Record<string, unknown>;
  };
  runId?: unknown;
  metadata?: Record<string, unknown>;
  thread_id?: unknown;
  checkpoint_ns?: unknown;
}
/**
 * Context derived from a LangGraph run. `correlationId` is omitted when the
 * graph did not provide a valid thread / checkpoint namespace / run id —
 * this helper never mints one.
 */
interface LangGraphAgentContext {
  correlationId?: string;
  metadata?: ArcjetMetadata;
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
declare function langgraphAgentContext(source?: LangGraphContextSource, init?: {
  metadata?: ArcjetMetadata;
}): LangGraphAgentContext;
//#endregion
export { LangGraphAgentContext, LangGraphContextSource, langgraphAgentContext };