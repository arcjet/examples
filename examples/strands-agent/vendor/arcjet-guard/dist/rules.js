/**
 * Rule factory functions for `@arcjet/guard`.
 *
 * Each exported function creates a concrete `RuleWithConfig*` type.
 * Calling the returned value with input produces the corresponding
 * `RuleWithInput*` ready for `.guard()`.
 *
 * @packageDocumentation
 */
import { nativeEntityTypes } from "./convert.js";
import { symbolArcjetInternal } from "./symbol.js";
/** Generate a random opaque identifier. */
function randomId() {
    return crypto.randomUUID();
}
/** Type guard for decisions carrying internal correlation data. */
function isInternalDecision(d) {
    return symbolArcjetInternal in d;
}
/** Extract internal results from a decision (empty array if absent). */
function getInternalResults(decision) {
    return isInternalDecision(decision) ? decision[symbolArcjetInternal].results : [];
}
/**
 * Find a single non-error result matching the given correlation IDs.
 *
 * Errored results ({@link RuleResultError}) are excluded — they are surfaced
 * only via `errorResult()`. This is the error/non-error split: a non-error
 * accessor must never return an errored result up-cast to the rule's own type.
 */
function findResult(decision, configId, inputId) {
    const match = getInternalResults(decision).find((r) => r[symbolArcjetInternal].configId === configId &&
        r[symbolArcjetInternal].inputId === inputId &&
        r.type !== "RULE_ERROR");
    if (!match)
        return null;
    const result = match;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- non-error result matched by correlation IDs; RULE_ERROR excluded above
    return result;
}
/** Find all non-error results for a given configId. */
function findResults(decision, configId) {
    return getInternalResults(decision)
        .filter((r) => r[symbolArcjetInternal].configId === configId && r.type !== "RULE_ERROR")
        .map((r) => {
        const result = r;
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- non-error results matched by configId; RULE_ERROR excluded above
        return result;
    });
}
/** Find the first denied result for a given configId. */
function findDeniedResult(decision, configId) {
    return findResults(decision, configId).find((r) => r.conclusion === "DENY") ?? null;
}
/**
 * Find the errored result for one specific submission, matched by both
 * correlation IDs. Returns only {@link RuleResultError} — never a non-error
 * result.
 */
function findErrorResult(decision, configId, inputId) {
    const match = getInternalResults(decision).find((r) => r[symbolArcjetInternal].configId === configId &&
        r[symbolArcjetInternal].inputId === inputId &&
        r.type === "RULE_ERROR");
    if (!match)
        return null;
    const result = match;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- matched on type === "RULE_ERROR" above
    return result;
}
/**
 * Find the first errored result for a given configId. Mirrors
 * {@link findDeniedResult}: if multiple invocations of the same rule errored,
 * returns one arbitrarily. There is deliberately no `errorResults()` plural —
 * retrieve per-submission via the bound input's `errorResult()`.
 */
function findErrorResultByConfig(decision, configId) {
    const match = getInternalResults(decision).find((r) => r[symbolArcjetInternal].configId === configId && r.type === "RULE_ERROR");
    if (!match)
        return null;
    const result = match;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- matched on type === "RULE_ERROR" above
    return result;
}
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
export function tokenBucket(config) {
    const configId = randomId();
    const rule = Object.assign((input) => {
        const inputId = randomId();
        return {
            type: "TOKEN_BUCKET",
            config,
            input,
            [symbolArcjetInternal]: { configId, inputId },
            result(decision) {
                return findResult(decision, configId, inputId);
            },
            deniedResult(decision) {
                const r = findResult(decision, configId, inputId);
                return r !== null && r.conclusion === "DENY" ? r : null;
            },
            results(decision) {
                const r = findResult(decision, configId, inputId);
                return r === null ? [] : [r];
            },
            errorResult(decision) {
                return findErrorResult(decision, configId, inputId);
            },
        };
    }, {
        type: "TOKEN_BUCKET",
        config,
        [symbolArcjetInternal]: { configId },
        results(decision) {
            return findResults(decision, configId);
        },
        result(decision) {
            return findResults(decision, configId)[0] ?? null;
        },
        deniedResult(decision) {
            return findDeniedResult(decision, configId);
        },
        errorResult(decision) {
            return findErrorResultByConfig(decision, configId);
        },
    });
    return rule;
}
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
export function fixedWindow(config) {
    const configId = randomId();
    const rule = Object.assign((input) => {
        const inputId = randomId();
        return {
            type: "FIXED_WINDOW",
            config,
            input,
            [symbolArcjetInternal]: { configId, inputId },
            result(decision) {
                return findResult(decision, configId, inputId);
            },
            deniedResult(decision) {
                const r = findResult(decision, configId, inputId);
                return r !== null && r.conclusion === "DENY" ? r : null;
            },
            results(decision) {
                const r = findResult(decision, configId, inputId);
                return r === null ? [] : [r];
            },
            errorResult(decision) {
                return findErrorResult(decision, configId, inputId);
            },
        };
    }, {
        type: "FIXED_WINDOW",
        config,
        [symbolArcjetInternal]: { configId },
        results(decision) {
            return findResults(decision, configId);
        },
        result(decision) {
            return findResults(decision, configId)[0] ?? null;
        },
        deniedResult(decision) {
            return findDeniedResult(decision, configId);
        },
        errorResult(decision) {
            return findErrorResultByConfig(decision, configId);
        },
    });
    return rule;
}
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
export function slidingWindow(config) {
    const configId = randomId();
    const rule = Object.assign((input) => {
        const inputId = randomId();
        return {
            type: "SLIDING_WINDOW",
            config,
            input,
            [symbolArcjetInternal]: { configId, inputId },
            result(decision) {
                return findResult(decision, configId, inputId);
            },
            deniedResult(decision) {
                const r = findResult(decision, configId, inputId);
                return r !== null && r.conclusion === "DENY" ? r : null;
            },
            results(decision) {
                const r = findResult(decision, configId, inputId);
                return r === null ? [] : [r];
            },
            errorResult(decision) {
                return findErrorResult(decision, configId, inputId);
            },
        };
    }, {
        type: "SLIDING_WINDOW",
        config,
        [symbolArcjetInternal]: { configId },
        results(decision) {
            return findResults(decision, configId);
        },
        result(decision) {
            return findResults(decision, configId)[0] ?? null;
        },
        deniedResult(decision) {
            return findDeniedResult(decision, configId);
        },
        errorResult(decision) {
            return findErrorResultByConfig(decision, configId);
        },
    });
    return rule;
}
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
export function detectPromptInjection(config = {}) {
    const configId = randomId();
    const rule = Object.assign((input) => {
        const inputId = randomId();
        return {
            type: "PROMPT_INJECTION",
            config,
            input: typeof input === "string" ? { inputText: input } : input,
            [symbolArcjetInternal]: { configId, inputId },
            result(decision) {
                return findResult(decision, configId, inputId);
            },
            deniedResult(decision) {
                const r = findResult(decision, configId, inputId);
                return r !== null && r.conclusion === "DENY" ? r : null;
            },
            results(decision) {
                const r = findResult(decision, configId, inputId);
                return r === null ? [] : [r];
            },
            errorResult(decision) {
                return findErrorResult(decision, configId, inputId);
            },
        };
    }, {
        type: "PROMPT_INJECTION",
        config,
        [symbolArcjetInternal]: { configId },
        results(decision) {
            return findResults(decision, configId);
        },
        result(decision) {
            return findResults(decision, configId)[0] ?? null;
        },
        deniedResult(decision) {
            return findDeniedResult(decision, configId);
        },
        errorResult(decision) {
            return findErrorResultByConfig(decision, configId);
        },
    });
    return rule;
}
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
export function moderateContent(config = {}) {
    const configId = randomId();
    const rule = Object.assign((input) => {
        const inputId = randomId();
        return {
            type: "MODERATE_CONTENT",
            config,
            input: typeof input === "string" ? { inputText: input } : input,
            [symbolArcjetInternal]: { configId, inputId },
            result(decision) {
                return findResult(decision, configId, inputId);
            },
            deniedResult(decision) {
                const r = findResult(decision, configId, inputId);
                return r !== null && r.conclusion === "DENY" ? r : null;
            },
            results(decision) {
                const r = findResult(decision, configId, inputId);
                return r === null ? [] : [r];
            },
            errorResult(decision) {
                return findErrorResult(decision, configId, inputId);
            },
        };
    }, {
        type: "MODERATE_CONTENT",
        config,
        [symbolArcjetInternal]: { configId },
        results(decision) {
            return findResults(decision, configId);
        },
        result(decision) {
            return findResults(decision, configId)[0] ?? null;
        },
        deniedResult(decision) {
            return findDeniedResult(decision, configId);
        },
        errorResult(decision) {
            return findErrorResultByConfig(decision, configId);
        },
    });
    return rule;
}
/**
 * Create a content moderation rule.
 *
 * @deprecated Use {@link moderateContent} instead.
 */
export const experimental_moderateContent = moderateContent;
/**
 * Throw if the config lists entity types the configured backend cannot detect.
 *
 * A configured {@link SensitiveInfoBackend} is trusted to detect whatever it
 * declares support for, so this only checks the default (bundled WASM) backend,
 * which detects `EMAIL`, `PHONE_NUMBER`, `IP_ADDRESS`, and `CREDIT_CARD_NUMBER`.
 * Listing any other {@link SensitiveInfoEntityType} without a `backend` that
 * supports it (such as `@arcjet/sensitive-info-rampart`) can never match, so we
 * surface it as a configuration error rather than silently doing nothing.
 */
function validateSensitiveInfoBackendSupport(config) {
    // A configured backend handles its own supported entity types.
    if (config.backend !== undefined) {
        return;
    }
    const entities = config.deny ?? config.allow ?? [];
    const unsupported = [...new Set(entities)].filter((entity) => !nativeEntityTypes.has(entity));
    if (unsupported.length === 0) {
        return;
    }
    const list = unsupported.map((entity) => `"${entity}"`).join(", ");
    const subject = unsupported.length === 1 ? "type is" : "types are";
    const object = unsupported.length === 1 ? "it" : "them";
    throw new Error(`\`localDetectSensitiveInfo\` config error: the ${list} ${subject} only detected ` +
        `when a \`backend\` that supports ${object} is configured (such as ` +
        `\`@arcjet/sensitive-info-rampart\`). The default backend only detects ` +
        `"EMAIL", "PHONE_NUMBER", "IP_ADDRESS", and "CREDIT_CARD_NUMBER".`);
}
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
export function localDetectSensitiveInfo(config = {}) {
    validateSensitiveInfoBackendSupport(config);
    const configId = randomId();
    const rule = Object.assign((input) => {
        const inputId = randomId();
        return {
            type: "SENSITIVE_INFO",
            config,
            input: typeof input === "string" ? { inputText: input } : input,
            [symbolArcjetInternal]: { configId, inputId },
            result(decision) {
                return findResult(decision, configId, inputId);
            },
            deniedResult(decision) {
                const r = findResult(decision, configId, inputId);
                return r !== null && r.conclusion === "DENY" ? r : null;
            },
            results(decision) {
                const r = findResult(decision, configId, inputId);
                return r === null ? [] : [r];
            },
            errorResult(decision) {
                return findErrorResult(decision, configId, inputId);
            },
        };
    }, {
        type: "SENSITIVE_INFO",
        config,
        [symbolArcjetInternal]: { configId },
        results(decision) {
            return findResults(decision, configId);
        },
        result(decision) {
            return findResults(decision, configId)[0] ?? null;
        },
        deniedResult(decision) {
            return findDeniedResult(decision, configId);
        },
        errorResult(decision) {
            return findErrorResultByConfig(decision, configId);
        },
    });
    return rule;
}
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
export function defineCustomRule(options) {
    return (config) => {
        const { data, mode, label, metadata } = config;
        const configId = randomId();
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowing generic evaluate to untyped internal form
        const evaluate = options.evaluate;
        const configObj = {
            ...(mode === undefined ? {} : { mode }),
            ...(label === undefined ? {} : { label }),
            ...(metadata === undefined ? {} : { metadata }),
            data: data,
            evaluate,
        };
        const rule = Object.assign((input) => {
            const { data: inputData, metadata: inputMetadata } = input;
            const inputId = randomId();
            const inputObj = {
                data: inputData,
                ...(inputMetadata === undefined ? {} : { metadata: inputMetadata }),
            };
            return {
                type: "CUSTOM",
                config: configObj,
                input: inputObj,
                evaluate,
                [symbolArcjetInternal]: { configId, inputId },
                result(decision) {
                    return findResult(decision, configId, inputId);
                },
                deniedResult(decision) {
                    const r = findResult(decision, configId, inputId);
                    return r !== null && r.conclusion === "DENY" ? r : null;
                },
                results(decision) {
                    const r = findResult(decision, configId, inputId);
                    return r === null ? [] : [r];
                },
                errorResult(decision) {
                    return findErrorResult(decision, configId, inputId);
                },
            };
        }, {
            type: "CUSTOM",
            config: configObj,
            [symbolArcjetInternal]: { configId },
            results(decision) {
                return findResults(decision, configId);
            },
            result(decision) {
                return findResults(decision, configId)[0] ?? null;
            },
            deniedResult(decision) {
                return findDeniedResult(decision, configId);
            },
            errorResult(decision) {
                return findErrorResultByConfig(decision, configId);
            },
        });
        return rule;
    };
}
