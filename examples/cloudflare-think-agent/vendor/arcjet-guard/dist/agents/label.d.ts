//#region src/agents/label.d.ts
/**
 * The guard label rule, as the service enforces it.
 *
 * This is a convenience that fails fast, not the place the rule lives. The
 * service enforces, and this check can be bypassed by an older SDK, another
 * language, or a direct API call — so it must never be stricter than the
 * service. A check that rejects a label the service accepts breaks working
 * code, which is not hypothetical: `arcjet-go` refused an underscore for a day
 * after the service began accepting one.
 *
 * Too loose is recoverable, because the service still reports the rejection at
 * call time as `AJ1023`. Too strict is not.
 *
 * The cases both sides agree on are in `test/_shared/guard-label-cases.json`,
 * copied from the source of truth in the `arcjet` monorepo. Every validator
 * that decides whether a label is usable reads them, so a copy that drifts
 * fails by name. Nothing enforces that this copy is current, because the
 * monorepo is private and this repository is public — a change to the grammar
 * updates every copy in the same change.
 */
/**
 * The code the service attaches when it rejected a label and substituted
 * `invalid-label`.
 */
export declare const LABEL_REJECTED_CODE = "AJ1023";
/**
 * Whether the service reported that it rejected this decision's label.
 *
 * When it did, the label it evaluated was `invalid-label`, so no published
 * policy could have matched and the guard did not run. That is unevaluated
 * policy rather than an allow, and every caller routes it through
 * `onGuardError` — which is why this lives in one place rather than in each of
 * the six decision classifiers.
 *
 * A capture call has no response to carry the code, so capture uses
 * {@link labelProblem} instead.
 */
export declare function labelRejectedByService(decision: {
  readonly warnings: readonly {
    readonly code: string;
  }[];
}): boolean;
/**
 * Thrown when a guard label cannot match any policy.
 *
 * A configuration error rather than a decision: nothing was evaluated. It is
 * raised where the label is written — at construction — rather than on every
 * call, so a misspelling fails once at startup instead of disabling the guard
 * for the life of the process.
 */
export declare class ArcjetInvalidLabelError extends Error {
  /** The label as written, so a caller can report or log it. */
  readonly label: string;
  constructor(label: string, where: string, problem: string);
}
/**
 * Why `label` is unusable, or `undefined` when it is usable.
 *
 * Non-throwing, because capture needs to warn without failing: a capture call
 * has no response to carry `AJ1023`, so this is the only signal available
 * there.
 */
export declare function labelProblem(label: string): string | undefined;
/**
 * Throw when `action` cannot match a policy.
 *
 * Call this where the label is known and the failure is cheap — at
 * construction, never per call. A label that only exists at call time is
 * judged by the service instead.
 *
 * @internal Adapter factories call this; `validateGuardLabel` is the public
 * spelling.
 */
export declare function assertValidAction(action: string, where: string): void;
/**
 * Throw when `label` cannot match a policy.
 *
 * The public spelling, matching Go's `ValidateGuardLabel`. Use it to check a
 * label you build yourself before handing it to a guard.
 *
 * @example
 * ```ts
 * import { validateGuardLabel } from "@arcjet/guard";
 *
 * validateGuardLabel("send_email.invoked"); // returns
 * validateGuardLabel("getWeather.invoked"); // throws ArcjetInvalidLabelError
 * ```
 */
export declare function validateGuardLabel(label: string): void;
//#endregion