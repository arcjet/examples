import { LocalWarning } from "./metadata.js";
import { Conclusion, Decision, Reason, RuleResult, RuleResultError, RuleWithInput, SensitiveInfoEntityType, Warning } from "./types.js";
import { GuardConclusion, GuardReason, GuardResponse, GuardRuleResult, GuardRuleSubmission } from "./proto/proto/decide/v2/decide_pb.js";
//#region src/convert.d.ts
/**
 * The {@link SensitiveInfoEntityType} values the bundled WASM engine detects
 * natively. Every other declared type is only detected when a
 * {@link SensitiveInfoBackend} that supports it is configured; listing one
 * without such a backend is a configuration error (see `rules.ts`).
 *
 * Keep in sync with the native tags mapped in {@link stringToEntity}.
 *
 * @internal
 */
declare const nativeEntityTypes: ReadonlySet<SensitiveInfoEntityType>;
/** Type guard: whether `value` is a declared {@link SensitiveInfoEntityType}. */
declare function isSensitiveInfoEntityType(value: string): value is SensitiveInfoEntityType;
/**
 * Map a proto `GuardConclusion` to the SDK `Conclusion` string.
 * Unrecognized values default to `"ALLOW"` (fail-open).
 *
 * @internal
 */
declare function conclusionFromProto(c: GuardConclusion): Conclusion;
/**
 * Map a proto result's oneof `case` to a broad SDK `Reason`.
 *
 * @internal
 */
declare function reasonFromCase(caseName: string | undefined): Reason;
/**
 * Map a proto `GuardReason` enum to the SDK `Reason` string.
 *
 * Used for the decision-level reason provided by the server, which
 * follows a fixed priority (SensitiveInfo > RateLimit > PromptInjection > Custom).
 *
 * @internal
 */
declare function reasonFromProto(r: GuardReason): Reason;
/**
 * Convert a single proto `GuardRuleResult` to the SDK `RuleResult`.
 *
 * Each result variant carries its own conclusion and typed fields.
 * `ResultError` results are mapped to `RuleResultError` with
 * `conclusion: "ALLOW"` (fail-open). `ResultNotRun` results are mapped
 * to `RuleResultNotRun` with `conclusion: "ALLOW"`.
 *
 * @internal
 */
declare function resultFromProto(pr: GuardRuleResult): RuleResult;
/**
 * Convert a `RuleWithInput` to a proto `GuardRuleSubmission`.
 *
 * Switches on the `type` discriminant so TypeScript narrows config/input
 * automatically — no casts required.
 */
declare function ruleToProto(rule: RuleWithInput, signal?: AbortSignal, options?: {
  /** Index of this rule in the submission, used to prefix warning messages. */
  ruleIndex?: number;
  /**
   * Sink for metadata keys the SDK could not encode. `GuardRuleSubmission` has
   * no `local_warnings` field of its own, so per-rule client-side diagnostics
   * ride on the request envelope.
   */
  warningsOut?: LocalWarning[];
}): Promise<GuardRuleSubmission>;
/**
 * Build the shared diagnostic members every decision carries — `warnings` plus
 * the derived `errorResults()` / `hasFailedOpen()` / `hasError()` helpers — from
 * a conclusion, its results, and any decision-level warnings.
 *
 * `errorResults()` scans `results` for `RuleResultError` (which includes the
 * synthetic error result used when a request could not be processed). It is
 * computed once and closed over so `hasFailedOpen()` and `errorResults()` share
 * a single scan rather than re-filtering on each call. `hasError()` is the
 * deprecated conflated union (warnings ∪ errors).
 *
 * @internal
 */
declare function decisionMembers(conclusion: Conclusion, results: readonly RuleResult[], warnings: readonly Warning[], additionalErrors?: readonly RuleResultError[]): {
  warnings: readonly Warning[];
  errorResults: () => readonly RuleResultError[];
  hasFailedOpen: () => boolean;
  hasError: () => boolean;
};
/**
 * Convert a proto `GuardResponse` to the SDK `Decision`.
 *
 * Correlates proto results back to SDK rule instances using
 * `config_id` and `input_id`.
 */
declare function decisionFromProto(response: GuardResponse, _rules: readonly RuleWithInput[], localWarnings?: readonly Warning[]): Decision;
//#endregion
export { conclusionFromProto, decisionFromProto, decisionMembers, isSensitiveInfoEntityType, nativeEntityTypes, reasonFromCase, reasonFromProto, resultFromProto, ruleToProto };