import { ArcjetAgentClient } from "../../agents/capture.js";
import { HookDefinition } from "eve/hooks";
//#region src/vercel-eve/v0/hooks.d.ts
/**
 * Which event families `arcjetHooks` captures.
 *
 * `"session"` → session lifecycle (started, failed).
 * `"turn"` → turn lifecycle (started, completed, failed).
 * `"tool"` → tool call lifecycle (action.result).
 * `"subagent"` → subagent delegation (called, completed).
 */
type ArcjetHookFamily = "session" | "turn" | "tool" | "subagent";
/**
 * Options for `arcjetHooks()`.
 */
interface ArcjetHooksOptions {
  /**
   * Which event families to capture. Defaults to all four. A long
   * conversation emits one event per tool call plus one per turn, so a chatty
   * agent may want `["session", "tool"]`.
   */
  events?: ReadonlyArray<ArcjetHookFamily>;
}
/**
 * Eve hooks for capturing Arcjet lifecycle decisions.
 *
 * Returns a `HookDefinition` carrying handlers for Eve stream events. The
 * returned object is suitable for wrapping with `defineHook()` at the agent
 * definition site.
 *
 * Handlers never throw and never block the turn, even if `capture()` fails.
 * Eve's hooks are documented as observe-only; a failing hook is a defect.
 *
 * The `session.started` event is the critical join point: it carries both the
 * session ID and (when available) the continuation token and channel kind from
 * the hook context. This record enables a `guardInbound` decision correlated
 * by thread token to be joined with all in-session decisions correlated by
 * session ID. They remain two separate Sequences; this record is what makes
 * each reachable from the other. Note Eve namespaces continuation tokens per
 * channel, so `eve.continuation-token` reads `<channel-name>:<token>` — the
 * inbound correlation id is its suffix, not the whole value.
 *
 * That event's `invocation` and `runtime` payloads are deliberately not
 * captured: the lineage identifiers in `invocation` are already reachable
 * through `ctx.session.parent`, and a second source for them could disagree
 * with the first, while `runtime` is deployment identity rather than anything
 * about the decision.
 *
 * Selective capture by family is supported via `options.events`: e.g.
 * `["session", "tool"]` captures only session-related and tool-related events,
 * reducing volume for long conversations that do not need turn-level granularity.
 *
 * @example
 * ```ts
 * import { launchArcjet } from "@arcjet/guard";
 * import { arcjetHooks } from "@arcjet/guard/vercel-eve/v0";
 * import { defineHook } from "eve/hooks";
 * import type { HookDefinition } from "eve/hooks";
 *
 * const client = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 *
 * // Capture only the session join record and tool outcomes; a long
 * // conversation emits one event per tool call plus one per turn.
 * const hooks: HookDefinition = defineHook(
 *   arcjetHooks(client, { events: ["session", "tool"] }),
 * );
 *
 * export default hooks;
 * ```
 *
 * @param client - An `ArcjetAgentClient` with `capture()` support
 * @param options - Optional event family filter (default: all four families)
 * @returns A `HookDefinition` ready to wrap with `defineHook()`
 */
declare function arcjetHooks(client: ArcjetAgentClient, options?: ArcjetHooksOptions): HookDefinition;
//#endregion
export { ArcjetHookFamily, ArcjetHooksOptions, arcjetHooks };