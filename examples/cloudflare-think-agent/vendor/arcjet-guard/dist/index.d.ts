import { ArcjetMetadata } from "./metadata.js";
import { PolicyInput, PolicyInputMap, policyInput } from "./policy-input.js";
import { Billing, CaptureOptions, Conclusion, CustomEvaluateFn, CustomEvaluateResult, Decision, DecisionAllow, DecisionBase, DecisionDeny, DetectPromptInjectionConfig, DetectPromptInjectionInput, ExperimentalModerateContentConfig, ExperimentalModerateContentInput, FixedWindowConfig, FixedWindowInput, GuardOptions, LocalCustomConfig, LocalCustomInput, LocalDetectSensitiveInfoConfig, LocalDetectSensitiveInfoInput, Mode, ModerateContentConfig, ModerateContentInput, PolicyEvaluation, PolicyRuleResult, Reason, RuleResult, RuleResultCustom, RuleResultError, RuleResultFixedWindow, RuleResultInputConstraint, RuleResultModerateContent, RuleResultNotRun, RuleResultPromptInjection, RuleResultSensitiveInfo, RuleResultSlidingWindow, RuleResultTokenBucket, RuleResultUnknown, RuleWithConfig, RuleWithConfigCustom, RuleWithConfigFixedWindow, RuleWithConfigModerateContent, RuleWithConfigPromptInjection, RuleWithConfigSensitiveInfo, RuleWithConfigSlidingWindow, RuleWithConfigTokenBucket, RuleWithInput, RuleWithInputCustom, RuleWithInputFixedWindow, RuleWithInputModerateContent, RuleWithInputPromptInjection, RuleWithInputSensitiveInfo, RuleWithInputSlidingWindow, RuleWithInputTokenBucket, SensitiveInfoBackend, SensitiveInfoBackendContext, SensitiveInfoBackendLogger, SensitiveInfoBackendOptions, SensitiveInfoEntityType, SlidingWindowConfig, SlidingWindowInput, StringMatchOperator, TokenBucketConfig, TokenBucketInput, Warning } from "./types.js";
import { DiagnosticLogger } from "./diagnostics.js";
import { defineCustomRule, detectPromptInjection, experimental_moderateContent, fixedWindow, localDetectSensitiveInfo, moderateContent, slidingWindow, tokenBucket } from "./rules.js";
import { capture, flush, guard, registerArcjet, unregisterArcjet } from "./registry.js";
import { Transport } from "@connectrpc/connect";
//#region src/index.d.ts
/**
 * Options for `launchArcjet()`.
 *
 * The client returned by `launchArcjet()` should be created **once** at
 * module scope and reused across requests. On Node.js it holds a
 * persistent HTTP/2 connection; on fetch runtimes it caches the
 * transport configuration. Creating a new client per request wastes
 * these resources.
 */
interface LaunchOptions {
  /** Arcjet key (starts with `"ajkey_"`). */
  key: string;
  /**
   * Not supported in `@arcjet/guard`.
   *
   * Rules are passed per `.guard()` call, not at launch time.
   * See {@link GuardOptions.rules}.
   *
   * @deprecated
   */
  rules?: never;
  /**
   * Not supported in `@arcjet/guard`.
   *
   * `@arcjet/guard` does not have the `characteristics` concept from
   * `@arcjet/node`. Use the `key` field on each rule input instead.
   *
   * @deprecated
   */
  characteristics?: never;
  /**
   * Override the default API base URL (`https://decide.arcjet.com`).
   * @internal
   */
  baseUrl?: string;
  /**
   * Local sensitive-info backend used to evaluate sensitive-info rules that a
   * remotely configured policy runs on the SDK. Defaults to the built-in
   * detector; supply an alternative (e.g. an on-device model) to change how
   * entities are detected.
   *
   * @example
   * ```ts
   * import { rampart } from "@arcjet/sensitive-info-rampart";
   *
   * const arcjet = launchArcjet({ key, sensitiveInfoBackend: rampart() });
   * ```
   */
  sensitiveInfoBackend?: SensitiveInfoBackend;
  /**
   * Receives every local SDK diagnostic.
   *
   * Without a logger, Arcjet writes one console warning per diagnostic code.
   */
  logger?: DiagnosticLogger;
}
/** An Arcjet guard client. */
interface ArcjetGuard {
  /** Evaluate a set of guard rules and return a decision. */
  guard(opts: GuardOptions): Promise<Decision>;
  /**
   * Record a fact about what the application did.
   *
   * Capture is best-effort visibility data. This method validates and enqueues
   * synchronously, never throws into application code, and does not imply that
   * the event was durably stored.
   */
  capture(opts: CaptureOptions): void;
  /**
   * Drain buffered capture events within a deadline.
   *
   * The default deadline is one second. Expiry drops and diagnoses the
   * remainder. The client stays usable and repeated calls are safe.
   */
  flush(timeoutMs?: number): Promise<void>;
}
/**
 * Create an Arcjet guard client with an explicit Connect transport.
 *
 * @internal Used by `node.ts` and `fetch.ts` to bind the correct transport.
 */
declare function launchArcjetWithTransport(options: LaunchOptions & {
  transport: Transport;
}): ArcjetGuard;
/**
 * Create an Arcjet guard client using a user-supplied transport factory.
 *
 * @internal Used by `node.ts` and `web.ts` to bind the correct transport.
 */
declare function _launchWithTransportFactory(createTransport: (baseUrl: string) => Transport, options: LaunchOptions): ArcjetGuard;
//#endregion
export { ArcjetGuard, type ArcjetMetadata, type Billing, type CaptureOptions, type Conclusion, type CustomEvaluateFn, type CustomEvaluateResult, type Decision, type DecisionAllow, type DecisionBase, type DecisionDeny, type DetectPromptInjectionConfig, type DetectPromptInjectionInput, type DiagnosticLogger, type ExperimentalModerateContentConfig, type ExperimentalModerateContentInput, type FixedWindowConfig, type FixedWindowInput, type GuardOptions, LaunchOptions, type LocalCustomConfig, type LocalCustomInput, type LocalDetectSensitiveInfoConfig, type LocalDetectSensitiveInfoInput, type Mode, type ModerateContentConfig, type ModerateContentInput, type PolicyEvaluation, type PolicyInput, type PolicyInputMap, type PolicyRuleResult, type Reason, type RuleResult, type RuleResultCustom, type RuleResultError, type RuleResultFixedWindow, type RuleResultInputConstraint, type RuleResultModerateContent, type RuleResultNotRun, type RuleResultPromptInjection, type RuleResultSensitiveInfo, type RuleResultSlidingWindow, type RuleResultTokenBucket, type RuleResultUnknown, type RuleWithConfig, type RuleWithConfigCustom, type RuleWithConfigFixedWindow, type RuleWithConfigModerateContent, type RuleWithConfigPromptInjection, type RuleWithConfigSensitiveInfo, type RuleWithConfigSlidingWindow, type RuleWithConfigTokenBucket, type RuleWithInput, type RuleWithInputCustom, type RuleWithInputFixedWindow, type RuleWithInputModerateContent, type RuleWithInputPromptInjection, type RuleWithInputSensitiveInfo, type RuleWithInputSlidingWindow, type RuleWithInputTokenBucket, type SensitiveInfoBackend, type SensitiveInfoBackendContext, type SensitiveInfoBackendLogger, type SensitiveInfoBackendOptions, type SensitiveInfoEntityType, type SlidingWindowConfig, type SlidingWindowInput, type StringMatchOperator, type TokenBucketConfig, type TokenBucketInput, type Warning, _launchWithTransportFactory, capture, defineCustomRule, detectPromptInjection, experimental_moderateContent, fixedWindow, flush, guard, launchArcjetWithTransport, localDetectSensitiveInfo, moderateContent, policyInput, registerArcjet, slidingWindow, tokenBucket, unregisterArcjet };