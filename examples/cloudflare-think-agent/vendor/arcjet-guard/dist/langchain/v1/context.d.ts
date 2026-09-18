import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
//#region src/langchain/v1/context.d.ts
/**
 * Structural source `langchainContext` can read.
 *
 * Accepts a LangChain `createAgent` invoke config (`configurable.thread_id`),
 * a `wrapToolCall` `request.runtime` (which carries `configurable` as of
 * langchain 1.2.34), a `tool()` invoke config / `ToolRuntime`, or the
 * `configurable` object itself. Caller-owned `sessionId` / `conversationId`
 * are fallbacks when no thread id is present.
 *
 * Never mints a new id. Never reads `traceId`. A resumed run passes the
 * same config, so it keeps its `thread_id`; the interrupt and its resume
 * value are never read as correlation sources. Declared here so this
 * module never value-imports `langchain` or `@langchain/core`.
 */
export interface LangChainContextSource {
  configurable?: Record<string, unknown>;
  config?: {
    configurable?: Record<string, unknown>;
  };
  runtime?: {
    configurable?: Record<string, unknown>;
    context?: unknown;
  };
  context?: unknown;
  sessionId?: unknown;
  conversationId?: unknown;
  correlationId?: unknown;
  thread_id?: unknown;
}
/**
 * Context derived from a LangChain `createAgent` run. `correlationId` is
 * omitted when nothing valid was present — this helper never mints one.
 */
export interface LangChainAgentContext {
  correlationId?: string;
  metadata?: ArcjetMetadata;
}
/**
 * Derive correlation and metadata from a LangChain `createAgent` invoke
 * config or a `wrapToolCall` `request.runtime`. Never mints a new id.
 * Never calls `createAgentContext`. Never reads `traceId`. A resumed run
 * keeps its `thread_id`, so the interrupt and its resume value are never
 * read as correlation sources.
 *
 * Preference order for `correlationId`:
 * 1. `configurable.thread_id` — what `wrapToolCall` sees on
 *    `runtime.configurable` as of langchain 1.2.34
 * 2. Caller-owned `sessionId`, then `conversationId`
 * 3. `init.sessionId` / `init.correlationId`
 *
 * An invalid candidate is skipped (and warned when `ARCJET_LOG_LEVEL`
 * asks for warnings). If nothing valid remains, `correlationId` is
 * omitted so the decision is uncorrelated rather than joined to a
 * generated id nobody has.
 *
 * @example
 * ```ts
 * import { langchainContext } from "@arcjet/guard/langchain/v1";
 *
 * export function fromInvoke(config: { configurable?: { thread_id?: string } }) {
 *   return langchainContext(config);
 * }
 * ```
 */
export declare function langchainContext(source?: LangChainContextSource, init?: {
  sessionId?: string;
  correlationId?: string;
  metadata?: ArcjetMetadata;
}): LangChainAgentContext;
//#endregion