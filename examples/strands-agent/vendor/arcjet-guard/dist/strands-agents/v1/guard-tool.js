import { shouldWarn } from "../../agents/capture.js";
import { denialResult, unavailableResult } from "../../agents/denial.js";
import { runGuarded } from "../../agents/guarded.js";
import { arcjetProtectedTool } from "../../agents/internal.js";
import { strandsAgentContext } from "./context.js";
function isContextSource(value) {
    return value !== null && typeof value === "object";
}
function isCallbackHolder(value) {
    return value !== null && typeof value === "object";
}
function toolName(tool) {
    if (typeof tool.name === "string" && tool.name.length > 0) {
        return tool.name;
    }
    if (typeof tool.toolSpec?.name === "string" && tool.toolSpec.name.length > 0) {
        return tool.toolSpec.name;
    }
    return undefined;
}
function resolveSessionId(policy, input) {
    if (typeof policy.sessionId === "function") {
        return policy.sessionId(input);
    }
    if (typeof policy.sessionId === "string" && policy.sessionId.length > 0) {
        return policy.sessionId;
    }
    return undefined;
}
function contextSource(context) {
    if (!isContextSource(context)) {
        return undefined;
    }
    if (context.invocationState !== undefined) {
        return context;
    }
    // A bare invocationState bag (or a ToolContext without a nested
    // `invocationState` field spelled that way) is still readable.
    return context;
}
/**
 * Wraps an authored `tool({ callback })` so the side-effect never runs
 * on DENY.
 *
 * After `tool()` the runner calls `stream()`, which calls `_callback`
 * (FunctionTool) or `_functionTool._callback` (ZodTool's validation
 * wrapper over the same authored function). `invoke()` calls
 * `_callback` directly. This helper replaces those callback slots so
 * every path is gated, and always runs `guard()` before the original
 * callback. On DENY the original callback never runs. The model
 * receives a plain `ArcjetDenialResult` (or the result of
 * `policy.onDeny`) as the callback return — `FunctionTool` wraps that
 * object in a `JsonBlock`. This helper does not throw on DENY and
 * does not fabricate a `ToolResultBlock`.
 *
 * Guard API errors depend on `policy.onGuardError` (defaults to `"deny"`):
 * - `"deny"` (default): callback does not run; the model receives an
 *   `ArcjetDenialResult` with `reason: "ERROR"`.
 * - `"allow"`: callback still runs, with a warning gated on
 *   `ARCJET_LOG_LEVEL`.
 *
 * Correlation is read from `toolContext.invocationState` (and
 * documented copies). No id is minted. `traceId`, `agent.id`, and
 * `SessionManager` are never read.
 *
 * MCP tools and anything not wrapped with `guardTool` skip this path
 * — use `guardHooks` for those. Do not also wrap the same tool with
 * `@arcjet/guard/vercel-ai/v7` or `@arcjet/guard/langgraph/v1`. The
 * shared `arcjetProtectedTool` brand throws on a second `guardTool`
 * wrap and lets `guardHooks` skip an already-guarded tool.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket } from "@arcjet/guard";
 * import { guardTool } from "@arcjet/guard/strands-agents/v1";
 * import { tool } from "@strands-agents/sdk";
 * import { z } from "zod";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const lookupLimit = tokenBucket({
 *   refillRate: 10,
 *   intervalSeconds: 60,
 *   maxTokens: 10,
 * });
 *
 * export const lookupOrder = guardTool(
 *   arcjet,
 *   tool({
 *     name: "lookup_order",
 *     description: "Look up an order by number",
 *     inputSchema: z.object({ orderNumber: z.string() }),
 *     callback: async ({ orderNumber }) => ({ orderNumber, status: "shipped" }),
 *   }),
 *   {
 *     action: "order.looked-up",
 *     rules: (input) => [lookupLimit({ key: input.orderNumber, requested: 1 })],
 *   },
 * );
 * ```
 */
export function guardTool(client, tool, policy) {
    if (!isCallbackHolder(tool) || typeof tool._callback !== "function") {
        // oxlint-disable-next-line unicorn/prefer-type-error -- Error preserves backward compatibility with the other vendor namespaces
        throw new Error("@arcjet/guard: guardTool() requires a tool() result with a callback. Pass the result of tool({ callback }), not the config object.");
    }
    if (arcjetProtectedTool in tool) {
        throw new Error("@arcjet/guard: guardTool() cannot wrap a tool that is already guarded; do not double-wrap with @arcjet/guard/strands-agents/v1, @arcjet/guard/vercel-ai/v7, or @arcjet/guard/langgraph/v1");
    }
    // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-type-assertion -- Object.getPrototypeOf is typed `any`
    const proto = Object.getPrototypeOf(tool);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.defineProperties copies every own descriptor, including symbols
    const wrapped = Object.defineProperties(Object.create(proto), Object.getOwnPropertyDescriptors(tool));
    installGuardedCallback(client, tool, policy, wrapped);
    const inner = wrapped._functionTool;
    if (isCallbackHolder(inner) && typeof inner._callback === "function") {
        // ZodTool.stream() delegates to this inner FunctionTool, which
        // closes over the authored callback at construction. Copy it so
        // the original tool's stream() path stays unguarded for the
        // caller who still holds that reference, then gate the copy.
        // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-type-assertion -- Object.getPrototypeOf is typed `any`
        const innerProto = Object.getPrototypeOf(inner);
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.defineProperties copies every own descriptor, including symbols
        const innerCopy = Object.defineProperties(Object.create(innerProto), Object.getOwnPropertyDescriptors(inner));
        installGuardedCallback(client, tool, policy, innerCopy);
        wrapped._functionTool = innerCopy;
    }
    Object.defineProperty(wrapped, arcjetProtectedTool, {
        value: true,
        enumerable: false,
        configurable: true,
    });
    return wrapped;
}
function installGuardedCallback(client, tool, policy, holder) {
    const original = holder._callback;
    if (typeof original !== "function") {
        return;
    }
    const guarded = (input, context) => runGuardedCallback(client, tool, policy, input, context, () => Promise.resolve(original(input, context)));
    Object.defineProperty(holder, "_callback", {
        value: guarded,
        writable: true,
        enumerable: false,
        configurable: true,
    });
}
function runGuardedCallback(client, tool, policy, input, context, execute) {
    const args = input === undefined ? {} : input;
    let sessionId;
    let rules;
    let policyMetadata;
    try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- args are the tool's parsed input; policy factories are typed against it
        const typedArgs = args;
        sessionId = resolveSessionId(policy, typedArgs);
        rules = typeof policy.rules === "function" ? policy.rules(typedArgs) : policy.rules;
        policyMetadata =
            typeof policy.metadata === "function" ? policy.metadata(typedArgs) : policy.metadata;
    }
    catch (error) {
        if (shouldWarn()) {
            console.warn('@arcjet/guard: policy factory for "%s" threw; treating as a guard error:', policy.action, error);
        }
        if (policy.onGuardError === "allow") {
            return execute();
        }
        return Promise.resolve(unavailableResult());
    }
    const source = contextSource(context);
    const agentCtx = strandsAgentContext(source, sessionId === undefined ? undefined : { sessionId });
    const name = toolName(tool);
    const metadata = {
        ...agentCtx.metadata,
        ...(name !== undefined && { "strands.tool": name }),
    };
    const mergedMetadata = { ...metadata, ...policyMetadata };
    return runGuarded(client, {
        action: policy.action,
        rules,
        correlationId: agentCtx.correlationId,
        metadata: mergedMetadata,
        onDeny: (decision) => {
            if (policy.onDeny === undefined) {
                return denialResult(decision);
            }
            try {
                return policy.onDeny(decision);
            }
            catch (error) {
                if (shouldWarn()) {
                    console.warn('@arcjet/guard: onDeny for "%s" threw; returning the default denial:', policy.action, error);
                }
                return denialResult(decision);
            }
        },
        onUnavailable: () => unavailableResult(),
        execute,
        onGuardError: policy.onGuardError ?? "deny",
    });
}
