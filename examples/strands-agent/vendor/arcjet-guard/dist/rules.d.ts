/**
 * Rule factory functions for `@arcjet/guard`.
 *
 * Each exported function creates a concrete `RuleWithConfig*` type.
 * Calling the returned value with input produces the corresponding
 * `RuleWithInput*` ready for `.guard()`.
 *
 * @packageDocumentation
 */
import type { ArcjetMetadata, TokenBucketConfig, FixedWindowConfig, SlidingWindowConfig, DetectPromptInjectionConfig, ModerateContentConfig, LocalDetectSensitiveInfoConfig, RuleWithConfigTokenBucket, RuleWithConfigFixedWindow, RuleWithConfigSlidingWindow, RuleWithConfigPromptInjection, RuleWithConfigModerateContent, RuleWithConfigSensitiveInfo, RuleWithConfigCustom, CustomEvaluateResult } from "./types.ts";
/**
 * Create a token bucket rate limiting rule.
 *
 * Use this when requests have variable cost — for example, an LLM
 * endpoint where each call consumes a different number of tokens.
 * The bucket refills at a steady rate and allows bursts up to
 * `maxTokens`, so users can spend tokens quickly but are throttled
 * once the bucket drains.
 *
 * Returns a configured rule that can be called with per-request input
 * (key + optional requested token count) to produce a `RuleWithInput`
 * ready for `.guard()`.
 *
 * @example
 * ```ts
 * const limit = tokenBucket({ bucket: "user-tokens", refillRate: 10, intervalSeconds: 60, maxTokens: 100 });
 * const decision = await arcjet.guard({
 *   label: "api.chat",
 *   rules: [limit({ key: userId })],
 * });
 * ```
 */
export declare function tokenBucket(config: TokenBucketConfig): RuleWithConfigTokenBucket;
/**
 * Create a fixed window rate limiting rule.
 *
 * Use this when you need a hard cap per time period — for example,
 * "100 requests per hour". The counter resets to zero at the end of
 * each window. Simple to reason about, but allows bursts at window
 * boundaries (a user could make 100 requests at 11:59 and 100 more
 * at 12:00). If that matters, use {@link slidingWindow} instead.
 *
 * Returns a configured rule that can be called with per-request input
 * (key + optional requested count) to produce a `RuleWithInput`
 * ready for `.guard()`.
 *
 * @example
 * ```ts
 * const limit = fixedWindow({ bucket: "page-views", maxRequests: 1000, windowSeconds: 3600 });
 * const decision = await arcjet.guard({
 *   label: "api.search",
 *   rules: [limit({ key: teamId })],
 * });
 * ```
 */
export declare function fixedWindow(config: FixedWindowConfig): RuleWithConfigFixedWindow;
/**
 * Create a sliding window rate limiting rule.
 *
 * Use this when you need smooth rate limiting without the burst-at-boundary
 * problem of fixed windows. The server interpolates between the previous
 * and current window, so "100 requests per hour" is enforced across
 * any rolling 60-minute span. Good default choice for API rate limits.
 *
 * Returns a configured rule that can be called with per-request input
 * (key + optional requested count) to produce a `RuleWithInput`
 * ready for `.guard()`.
 *
 * @example
 * ```ts
 * const limit = slidingWindow({ bucket: "event-writes", maxRequests: 500, intervalSeconds: 60 });
 * const decision = await arcjet.guard({
 *   label: "api.events",
 *   rules: [limit({ key: userId })],
 * });
 * ```
 */
export declare function slidingWindow(config: SlidingWindowConfig): RuleWithConfigSlidingWindow;
/**
 * Create a server-side prompt injection detection rule.
 *
 * Use this when your application passes user-supplied text to an LLM
 * and you want to block attempts to override system prompts or
 * extract hidden instructions. Also useful for scanning tool call
 * results that contain untrusted input — for example, a "fetch" tool
 * that loads a webpage which could embed injected instructions.
 *
 * Returns a configured rule that can be called with user-supplied text
 * to produce a `RuleWithInput` ready for `.guard()`. The text is sent
 * to the Arcjet Cloud API for analysis.
 *
 * @example
 * ```ts
 * const pi = detectPromptInjection();
 * const decision = await arcjet.guard({
 *   label: "tools.chat",
 *   rules: [pi(userMessage)],
 * });
 * ```
 */
export declare function detectPromptInjection(config?: DetectPromptInjectionConfig): RuleWithConfigPromptInjection;
/**
 * Create a content moderation rule.
 *
 * Use this when your application accepts user-supplied text and you want
 * to block harmful content before it is stored, displayed, or forwarded
 * to another service. Also useful for scanning tool call results or
 * model outputs that should not contain disallowed content.
 *
 * Returns a configured rule that can be called with user-supplied text
 * to produce a `RuleWithInput` ready for `.guard()`. The text is sent
 * to the Arcjet Cloud API for analysis.
 *
 * A successful result includes `detected` (whether harmful content was
 * found) and optional `billing`. Transport errors follow the `guard()`
 * fail-open convention.
 *
 * Per-request metadata is attached on the input object
 * (`{ inputText, metadata }`), not as a second argument, and is merged
 * with any config-level metadata (call-time wins on key conflict).
 *
 * @example
 * ```ts
 * const moderate = moderateContent();
 * const decision = await arcjet.guard({
 *   label: "tools.chat",
 *   rules: [moderate(userMessage)],
 * });
 * ```
 *
 * @example
 * ```ts
 * // Attach per-request metadata for analytics/correlation.
 * const moderate = moderateContent({ metadata: { variant: "new" } });
 * const decision = await arcjet.guard({
 *   label: "tools.chat",
 *   rules: [moderate({ inputText: userMessage, metadata: { expectedResponse: "pass" } })],
 * });
 * ```
 */
export declare function moderateContent(config?: ModerateContentConfig): RuleWithConfigModerateContent;
/**
 * Create a content moderation rule.
 *
 * @deprecated Use {@link moderateContent} instead.
 */
export declare const experimental_moderateContent: typeof moderateContent;
/**
 * Create a sensitive information detection rule.
 *
 * Use this to prevent PII (emails, phone numbers, credit card numbers)
 * from being sent to third-party services or stored in logs. The
 * detection runs locally via WASM — only a SHA-256 hash of the text
 * is transmitted to the Arcjet Cloud API, never the raw content.
 *
 * Use `allow` / `deny` in the config to control which entity types
 * trigger a denial (e.g. `{ deny: ["CREDIT_CARD_NUMBER", "PHONE_NUMBER"] }`).
 * Omitting both denies all detected entity types.
 *
 * Returns a configured rule that can be called with user-supplied text
 * to produce a `RuleWithInput` ready for `.guard()`.
 *
 * @example
 * ```ts
 * const si = localDetectSensitiveInfo({ deny: ["CREDIT_CARD_NUMBER"] });
 * const decision = await arcjet.guard({
 *   label: "tools.summary",
 *   rules: [si(userMessage)],
 * });
 * ```
 */
export declare function localDetectSensitiveInfo(config?: LocalDetectSensitiveInfoConfig): RuleWithConfigSensitiveInfo;
/**
 * Define a typed custom rule.
 *
 * Returns a factory function that creates `RuleWithConfigCustom<TData>`
 * instances. The config, input, and result data types are preserved
 * through the entire chain — from rule creation to `.result()` on
 * the decision.
 *
 * @typeParam TConfig - Shape of the config data (string values).
 * @typeParam TInput  - Shape of the per-request input data (string values).
 * @typeParam TData   - Shape of the result data returned by `evaluate`.
 *
 * @example
 * ```ts
 * const topicBlock = defineCustomRule<
 *   { blockedTopic: string },
 *   { topic: string },
 *   { matched: string }
 * >({
 *   evaluate: (config, input) => {
 *     if (input.topic === config.blockedTopic) {
 *       return { conclusion: "DENY", data: { matched: input.topic } };
 *     }
 *     return { conclusion: "ALLOW" };
 *   },
 * });
 *
 * // Create the rule config at module scope
 * const rule = topicBlock({ data: { blockedTopic: "politics" } });
 *
 * // Per request
 * const decision = await arcjet.guard({
 *   rules: [rule({ data: { topic: userTopic } })],
 * });
 * const r = rule.result(decision);
 * if (r) {
 *   r.data.matched; // string — fully typed
 * }
 * ```
 */
export declare function defineCustomRule<TConfig extends Record<string, string>, TInput extends Record<string, string>, TData extends Record<string, string> = Record<string, string>>(options: {
    evaluate: (config: Readonly<TConfig>, input: Readonly<TInput>, options: {
        signal?: AbortSignal;
    }) => CustomEvaluateResult<TData> | Promise<CustomEvaluateResult<TData>>;
}): (config: {
    data: TConfig;
    mode?: "LIVE" | "DRY_RUN";
    label?: string;
    metadata?: ArcjetMetadata;
}) => RuleWithConfigCustom<TData, TInput>;
