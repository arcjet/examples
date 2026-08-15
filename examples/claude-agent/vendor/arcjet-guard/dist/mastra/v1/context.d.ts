import { ArcjetMetadata } from "../../metadata.js";
import "../../types.js";
//#region src/mastra/v1/context.d.ts
/**
 * Reserved RequestContext keys from `@mastra/core`. Hardcoded so this module
 * never value-imports Mastra — CI must pass with `@mastra/core` absent from
 * `node_modules`.
 *
 * @see https://mastra.ai/docs/server/request-context
 */
declare const MASTRA_THREAD_ID_KEY: "mastra__threadId";
declare const MASTRA_RESOURCE_ID_KEY: "mastra__resourceId";
/**
 * Minimal RequestContext surface this helper reads. Structural so tests and
 * callers can pass a Map-like mock without importing Mastra.
 */
interface MastraRequestContextLike {
  get(key: string): unknown;
}
/**
 * Execution-shaped source `mastraAgentContext` can read. Accepts a
 * RequestContext directly, or a tool / processor / hook context that carries
 * `requestContext`, optional agent thread/resource, and optional workflow run.
 */
interface MastraContextSource {
  requestContext?: MastraRequestContextLike;
  agent?: {
    threadId?: string;
    resourceId?: string;
  };
  workflow?: {
    runId?: string;
  };
}
/**
 * Context derived from Mastra. `correlationId` is omitted when Mastra did not
 * provide a valid thread, resource, or run id — this helper never mints one.
 */
interface MastraAgentContext {
  correlationId?: string;
  metadata?: ArcjetMetadata;
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
declare function mastraAgentContext(source?: MastraRequestContextLike | MastraContextSource, init?: {
  metadata?: ArcjetMetadata;
}): MastraAgentContext;
//#endregion
export { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, MastraAgentContext, MastraContextSource, MastraRequestContextLike, mastraAgentContext };