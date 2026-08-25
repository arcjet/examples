import type { Plugin } from "@strands-agents/sdk";
import type { ArcjetAgentClient } from "../../agents/capture.ts";
import type { OnGuardError } from "../../agents/guard-action.ts";
import type { ArcjetMetadata, DecisionDeny, RuleWithInput } from "../../types.ts";
/**
 * Input passed to `rules` / `metadata` / `action` callbacks on `guardHooks`.
 * `input` is the tool's free-text args, not the opaque `toolUseId`.
 */
export interface GuardHooksCall {
    toolName: string;
    input: unknown;
}
/**
 * Policy for `guardHooks()` — a Plugin whose `initAgent` registers
 * `BeforeToolCallEvent` (deny unwrapped / MCP-like tools) and
 * `AfterToolCallEvent` (capture only).
 *
 * ## Screen inbound before `invoke()` / `stream()` — there is no inbound hook.
 *
 * There is no first-class inbound channel, so there is no `guardInbound`.
 * Middleware / model hooks are not this gate.
 *
 * ## `interrupt()` is not a policy gate.
 *
 * `event.interrupt()` is human-in-the-loop. Same trap as Mastra
 * `requireApproval`, Claude `canUseTool`, LangGraph `interrupt()`,
 * OpenAI Agents `needsApproval`, and LangChain
 * `humanInTheLoopMiddleware`. This helper never calls it.
 *
 * ## Deny with `BeforeToolCallEvent.cancel`. `BeforeToolsEvent.cancel`
 * skips per-tool hooks — do not use it.
 *
 * Official: set `event.cancel` to a string. `tool.stream()` does not
 * run; `AfterToolCallEvent` still fires. A non-InterruptError throw
 * aborts the invocation and drops the envelope, so this helper never
 * throws.
 */
export interface GuardHooksPolicy {
    /**
     * Guard label and capture action. Defaults to `"tool.invoked"`. May be a
     * function of the tool name and input.
     */
    action?: string | ((call: GuardHooksCall) => string);
    /**
     * Rules to evaluate before an unwrapped tool runs. Omitting this still
     * performs the guard call.
     */
    rules?: RuleWithInput[] | ((call: GuardHooksCall) => RuleWithInput[]);
    /** Metadata merged over the derived Strands context. */
    metadata?: ArcjetMetadata | ((call: GuardHooksCall) => ArcjetMetadata);
    /**
     * Fallback session id when `invocationState` does not carry one.
     * Prefer putting the id you already chose on
     * `agent.invoke(..., { invocationState: { sessionId } })`. Never mint
     * a new id here.
     */
    sessionId?: string | ((call: GuardHooksCall) => string | undefined);
    /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
    onGuardError?: OnGuardError;
    /**
     * Reshape the denial payload JSON-stringified onto `event.cancel` for
     * a real DENY decision. Unavailable guards take the `onUnavailable`
     * path instead.
     */
    onDeny?: (decision: DecisionDeny) => unknown;
}
/**
 * Structural `BeforeToolCallEvent` this helper mutates. Declared here
 * so tests can drive the handler without constructing the SDK class.
 */
export interface StrandsBeforeToolCallEvent {
    toolUse?: {
        name?: unknown;
        input?: unknown;
        toolUseId?: unknown;
    };
    tool?: object;
    invocationState?: unknown;
    cancel?: boolean | string;
    interrupt?: (...args: never[]) => unknown;
}
/**
 * Structural `AfterToolCallEvent` this helper reads for capture.
 */
export interface StrandsAfterToolCallEvent {
    toolUse?: {
        name?: unknown;
        input?: unknown;
    };
    error?: unknown;
    invocationState?: unknown;
}
/**
 * The Plugin this helper returns. Matches the SDK `Plugin` interface
 * (`name` + `initAgent`) via `import type` only.
 */
export type StrandsGuardPlugin = Plugin;
/**
 * The `BeforeToolCallEvent` handler. Exported for src tests so the
 * deny / allow / brand-skip path can run without loading the peer
 * (the Plugin's `initAgent` is the only place that value-imports).
 */
export declare function createBeforeToolCallHandler(client: ArcjetAgentClient, policy?: GuardHooksPolicy): (event: StrandsBeforeToolCallEvent) => Promise<void>;
/**
 * The `AfterToolCallEvent` handler. Capture only; never sets cancel
 * and never throws.
 */
export declare function createAfterToolCallHandler(client: ArcjetAgentClient, policy?: GuardHooksPolicy): (event: StrandsAfterToolCallEvent) => void;
/**
 * A Plugin registered on `new Agent({ plugins })`.
 *
 * `initAgent` calls `agent.addHook(BeforeToolCallEvent, …, { order:
 * HookOrder.SDK_FIRST - 1 })` so this gate runs before the SDK's own
 * earliest hooks. On DENY it sets `event.cancel` to
 * `JSON.stringify(ArcjetDenialResult)`. `tool.stream()` does not run;
 * `AfterToolCallEvent` still fires.
 *
 * Already-branded (`guardTool`) tools are skipped so Guard is not
 * double-called. Tools that are not branded — MCP, vended tools,
 * anything not wrapped — are still gated.
 *
 * Do **not** use `BeforeToolsEvent.cancel` (that skips per-tool hooks).
 * Do **not** call `event.interrupt()` (that is HITL).
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardHooks } from "@arcjet/guard/strands-agents/v1";
 * import { Agent } from "@strands-agents/sdk";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const mcpLimit = tokenBucket({
 *   refillRate: 20,
 *   intervalSeconds: 60,
 *   maxTokens: 20,
 * });
 *
 * const agent = new Agent({
 *   tools: [lookupOrder],
 *   plugins: [
 *     guardHooks(arcjet, {
 *       action: ({ toolName }) => `${toolName}.invoked`,
 *       rules: ({ toolName }) => [mcpLimit({ key: toolName, requested: 1 })],
 *       sessionId: conversationId,
 *     }),
 *   ],
 * });
 * ```
 */
export declare function guardHooks(client: ArcjetAgentClient, policy?: GuardHooksPolicy): StrandsGuardPlugin;
