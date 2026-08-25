import { PolicyInput, PolicyInputMap, policyInput } from "./policy-input.js";
import { Billing, CaptureOptions, Conclusion, Decision, DecisionAllow, DecisionBase, DecisionDeny, DetectPromptInjectionConfig, DetectPromptInjectionInput, ExperimentalModerateContentConfig, ExperimentalModerateContentInput, FixedWindowConfig, FixedWindowInput, GuardOptions, LocalCustomConfig, LocalCustomInput, LocalDetectSensitiveInfoConfig, LocalDetectSensitiveInfoInput, Mode, ModerateContentConfig, ModerateContentInput, PolicyEvaluation, PolicyRuleResult, Reason, RuleResult, RuleResultCustom, RuleResultError, RuleResultFixedWindow, RuleResultInputConstraint, RuleResultModerateContent, RuleResultNotRun, RuleResultPromptInjection, RuleResultSensitiveInfo, RuleResultSlidingWindow, RuleResultTokenBucket, RuleResultUnknown, RuleWithConfig, RuleWithInput, SensitiveInfoBackend, SensitiveInfoBackendContext, SensitiveInfoBackendLogger, SensitiveInfoBackendOptions, SensitiveInfoEntityType, SlidingWindowConfig, SlidingWindowInput, StringMatchOperator, TokenBucketConfig, TokenBucketInput } from "./types.js";
import { DiagnosticLogger } from "./diagnostics.js";
import { defineCustomRule, detectPromptInjection, experimental_moderateContent, fixedWindow, localDetectSensitiveInfo, moderateContent, slidingWindow, tokenBucket } from "./rules.js";
import { capture, flush, guard, registerArcjet, unregisterArcjet } from "./registry.js";
import { ArcjetGuard, LaunchOptions, _launchWithTransportFactory, launchArcjetWithTransport } from "./index.js";
import { createTransport } from "./transport-fetch.js";
//#region src/fetch.d.ts
/**
 * Create an Arcjet guard client using the fetch-based transport.
 *
 * Compatible with Deno, Bun, Cloudflare Workers, browsers, and
 * any runtime providing the WHATWG Fetch API.
 *
 * Connect to the Arcjet MCP server at `https://api.arcjet.com/mcp` to manage
 * sites, retrieve SDK keys, and more. Learn more at
 * {@link https://docs.arcjet.com/mcp-server}.
 *
 * **Create once, reuse everywhere.** The returned client should be
 * created at module scope so it can be shared across requests.
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
 */
declare function launchArcjet(options: LaunchOptions): ArcjetGuard;
//#endregion
export { type ArcjetGuard, type Billing, type CaptureOptions, type Conclusion, type Decision, type DecisionAllow, type DecisionBase, type DecisionDeny, type DetectPromptInjectionConfig, type DetectPromptInjectionInput, type DiagnosticLogger, type ExperimentalModerateContentConfig, type ExperimentalModerateContentInput, type FixedWindowConfig, type FixedWindowInput, type GuardOptions, type LaunchOptions, type LocalCustomConfig, type LocalCustomInput, type LocalDetectSensitiveInfoConfig, type LocalDetectSensitiveInfoInput, type Mode, type ModerateContentConfig, type ModerateContentInput, type PolicyEvaluation, type PolicyInput, type PolicyInputMap, type PolicyRuleResult, type Reason, type RuleResult, type RuleResultCustom, type RuleResultError, type RuleResultFixedWindow, type RuleResultInputConstraint, type RuleResultModerateContent, type RuleResultNotRun, type RuleResultPromptInjection, type RuleResultSensitiveInfo, type RuleResultSlidingWindow, type RuleResultTokenBucket, type RuleResultUnknown, type RuleWithConfig, type RuleWithInput, type SensitiveInfoBackend, type SensitiveInfoBackendContext, type SensitiveInfoBackendLogger, type SensitiveInfoBackendOptions, type SensitiveInfoEntityType, type SlidingWindowConfig, type SlidingWindowInput, type StringMatchOperator, type TokenBucketConfig, type TokenBucketInput, _launchWithTransportFactory, capture, createTransport, defineCustomRule, detectPromptInjection, experimental_moderateContent, fixedWindow, flush, guard, launchArcjet, launchArcjetWithTransport, localDetectSensitiveInfo, moderateContent, policyInput, registerArcjet, slidingWindow, tokenBucket, unregisterArcjet };