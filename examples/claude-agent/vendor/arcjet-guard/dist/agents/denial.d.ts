import { DecisionDeny } from "../types.js";
//#region src/agents/denial.d.ts
/**
 * Seconds until a rate-limited call may be retried, or `undefined` when the
 * decision carries no reset time to derive one from.
 *
 * Only meaningful for a `RATE_LIMIT` denial. A co-occurring rule that allowed
 * can still leave a `resetAtUnixSeconds` in `decision.results`, so the caller
 * decides whether to consult this at all — the reason check stays with the
 * caller rather than being duplicated here.
 *
 * @internal Exported for use by the vendor namespaces, so every one of them
 * reports the same retry-after; not part of the public API.
 */
declare function retryAfterSeconds(decision: DecisionDeny): number | undefined;
//#endregion
export { retryAfterSeconds };