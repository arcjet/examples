/**
 * `@arcjet/guard` — Arcjet Guards SDK for JavaScript/TypeScript.
 *
 * Guards provide rate limiting, prompt injection detection, sensitive
 * information detection, and custom rules for AI tool calls and other
 * backend operations.
 *
 * Import everything from the root specifier — the correct transport
 * is selected automatically via conditional exports (HTTP/2 on Node.js
 * and Bun, fetch-based on Deno, Cloudflare Workers, and browsers).
 *
 * **Lifecycle:** Create the client and rule configs once at module
 * scope. Only rule *inputs* are created per request.
 *
 * @example
 * ```ts
 * import { launchArcjet, tokenBucket, detectPromptInjection } from "@arcjet/guard";
 *
 * // Create the client once at module scope
 * const arcjet = launchArcjet({ key: "ajkey_..." });
 *
 * // Configure reusable rules (also at module scope)
 * const limitRule = tokenBucket({ bucket: "user-tokens", refillRate: 10, intervalSeconds: 60, maxTokens: 100 });
 * const piRule = detectPromptInjection();
 *
 * // Per request — create rule inputs each time
 * const rl = limitRule({ key: userId, requested: tokenCount });
 * const decision = await arcjet.guard({
 *   label: "tools.weather",
 *   rules: [rl, piRule(userMessage)],
 * });
 *
 * // Overall decision
 * if (decision.conclusion === "DENY") {
 *   console.log(decision.reason); // "RATE_LIMIT", "PROMPT_INJECTION", etc.
 * }
 *
 * // Fail open by default; opt in to fail closed when a rule could not run.
 * if (decision.hasFailedOpen()) {
 *   console.warn("a rule could not be evaluated", decision.errorResults());
 * }
 *
 * // Request diagnostics — the decision is still valid.
 * for (const warning of decision.warnings) {
 *   console.warn(warning.code, warning.message);
 * }
 *
 * // Per-rule results
 * for (const result of decision.results) {
 *   console.log(result.type, result.conclusion);
 * }
 *
 * // From a RuleWithInput — result for this specific submission
 * const r = rl.result(decision);
 * if (r) {
 *   console.log(r.remainingTokens, r.maxTokens);
 * }
 *
 * // From a RuleWithConfig — first denied result across all submissions
 * const denied = limitRule.deniedResult(decision);
 * if (denied) {
 *   console.log(denied.remainingTokens); // 0
 * }
 * ```
 *
 * Unlike some other `@arcjet/*` packages, `@arcjet/guard` never reads
 * environment variables directly. All configuration must be passed
 * explicitly via `launchArcjet()` options, `.guard()`, or rule inputs.
 *
 * Connect to the Arcjet MCP server at `https://api.arcjet.com/mcp` to manage
 * sites, retrieve SDK keys, and more. Learn more at
 * {@link https://docs.arcjet.com/mcp-server}.
 *
 * @packageDocumentation
 */
import { createGuardClient } from "./client.js";
import { symbolArcjetDiagnostics, } from "./diagnostics.js";
export { policyInput } from "./policy-input.js";
export { tokenBucket, fixedWindow, slidingWindow, detectPromptInjection, moderateContent, localDetectSensitiveInfo, defineCustomRule, } from "./rules.js";
// oxlint-disable-next-line typescript/no-deprecated -- public deprecated alias
export { experimental_moderateContent } from "./rules.js";
// Optional registration, and the free calls it enables. Nothing here takes
// effect until an application calls `registerArcjet()` — `launchArcjet()`
// itself touches no global state.
export { registerArcjet, unregisterArcjet, guard, capture, flush } from "./registry.js";
/**
 * Create an Arcjet guard client with an explicit Connect transport.
 *
 * @internal Used by `node.ts` and `fetch.ts` to bind the correct transport.
 */
export function launchArcjetWithTransport(options) {
    const client = createGuardClient({
        key: options.key,
        transport: options.transport,
        ...(options.logger === undefined ? {} : { logger: options.logger }),
        ...(options.sensitiveInfoBackend === undefined
            ? {}
            : { sensitiveInfoBackend: options.sensitiveInfoBackend }),
    });
    // The diagnostics channel rides along under a symbol so registration can
    // report a second `registerArcjet()` on the logger this client was launched
    // with. It stays off `ArcjetGuard`, so it is not public API.
    const launched = {
        guard(opts) {
            return client.guard(opts);
        },
        capture(opts) {
            client.capture(opts);
        },
        flush(timeoutMs) {
            return client.flush(timeoutMs);
        },
        [symbolArcjetDiagnostics]: client[symbolArcjetDiagnostics],
    };
    return launched;
}
/**
 * Create an Arcjet guard client using a user-supplied transport factory.
 *
 * @internal Used by `node.ts` and `web.ts` to bind the correct transport.
 */
export function _launchWithTransportFactory(createTransport, options) {
    const baseUrl = options.baseUrl ?? "https://decide.arcjet.com";
    const transport = createTransport(baseUrl);
    return launchArcjetWithTransport({ ...options, transport });
}
