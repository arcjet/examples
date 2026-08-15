import { ArcjetMetadata } from "../../metadata.js";
import { DecisionAllow, DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
//#region src/vercel-eve/v0/gate.d.ts
/**
 * The guard → capture sequence for a call site that decides whether something
 * may run but does not run it. This is the gate engine shared by all Eve
 * approval enforcement (tools, OpenAPI connections, MCP connections).
 *
 * Unlike `runGuarded`, which also executes and captures execution outcomes:
 * - There is no execute. The allow tail returns immediately. Nothing here can
 *   produce `"success"` or `"error"` — a gate that passed has not done the thing.
 * - The allow outcome is `"allowed"`, not `"success"` — a distinction that
 *   keeps "the tool ran" and "the tool was permitted to run" separate on the
 *   capture stream.
 *
 * Contract:
 *
 * 1. `onGuardError` defaults to `"deny"`.
 * 2. Build `correlation` as `correlationId === undefined ? {} : { correlationId }` —
 *    the field is optional under `exactOptionalPropertyTypes`, so assigning
 *    `undefined` is a type error.
 * 3. Call `client.guard()` inside a `try`. Always call it, including with no rules.
 * 4. On throw: if failing closed, warn, capture with `outcome: "unavailable"`,
 *    return `onUnavailable({ kind: "threw", error })`. If failing open, warn
 *    and fall through to the allow tail.
 * 5. Suppress `decision.id === ""` — a fail-open decision carries an empty id
 *    and `""` is not a correlatable value.
 * 6. If ALLOW with failed-open and failing closed: warn, capture `"unavailable"`,
 *    `onUnavailable({ kind: "failed-open", decision })`. Keep the conjunction
 *    inside the single `if`: TypeScript cannot narrow on a method return.
 * 7. If ALLOW with failed-open and failing open: warn, fall through.
 * 8. If DENY: capture `"denied"`, return `onDeny(decision)`.
 * 9. Allow tail: capture `"allowed"`, return `onAllow()`.
 *
 * Every capture goes through `captureEvent`, which swallows throws.
 */
declare function runGate<T>(client: ArcjetAgentClient, params: {
  action: string;
  rules: RuleWithInput[] | undefined;
  correlationId: string | undefined;
  metadata: ArcjetMetadata;
  onAllow: () => T;
  onDeny: (decision: DecisionDeny) => T;
  onUnavailable: (unavailable: {
    kind: "threw";
    error: unknown;
  } | {
    kind: "failed-open";
    decision: DecisionAllow;
  }) => T;
  onGuardError?: "allow" | "deny";
}): Promise<T>;
//#endregion
export { runGate };