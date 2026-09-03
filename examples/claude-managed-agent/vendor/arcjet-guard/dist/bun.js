import { policyInput } from "./policy-input.js";
import { defineCustomRule, detectPromptInjection, experimental_moderateContent, fixedWindow, localDetectSensitiveInfo, moderateContent, slidingWindow, tokenBucket } from "./rules.js";
import { capture, flush, guard, registerArcjet, unregisterArcjet } from "./registry.js";
import { _launchWithTransportFactory, launchArcjetWithTransport } from "./index.js";
import { createTransport } from "./transport-bun.js";
//#region src/bun.ts
/**
* Create an Arcjet guard client using the Bun transport.
*
* Connects over HTTP/2 by default, falling back to a fetch-based transport when
* a proxy is configured so Bun's native `fetch` performs the proxying.
*
* Connect to the Arcjet MCP server at `https://api.arcjet.com/mcp` to manage
* sites, retrieve SDK keys, and more. Learn more at
* {@link https://docs.arcjet.com/mcp-server}.
*
* **Create once, reuse everywhere.** The returned client holds a
* persistent HTTP/2 connection that is optimistically pre-connected.
* Wrapping this in a function that creates a new client per request
* defeats connection reuse and adds latency.
*
* Three lifetimes to keep in mind:
* 1. **Client** (`launchArcjet`) — create once at module scope.
* 2. **Rule config** (`tokenBucket(...)`) — create once at module scope (recommended).
* 3. **Rule input** (`limitRule({ key })`) — create per request / tool call.
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
* // Check for errors (fail-open — errors don't cause denials)
* if (decision.hasError()) {
*   console.warn("At least one rule errored");
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
*/
function launchArcjet(options) {
	return _launchWithTransportFactory(createTransport, options);
}
//#endregion
export { _launchWithTransportFactory, capture, createTransport, defineCustomRule, detectPromptInjection, experimental_moderateContent, fixedWindow, flush, guard, launchArcjet, launchArcjetWithTransport, localDetectSensitiveInfo, moderateContent, policyInput, registerArcjet, slidingWindow, tokenBucket, unregisterArcjet };
