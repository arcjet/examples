import { ArcjetMetadata } from "../metadata.js";
import { PolicyInputMap } from "../policy-input.js";
import { DecisionAllow, DecisionDeny, RuleWithInput } from "../types.js";
import { ArcjetAgentClient } from "./capture.js";
//#region src/agents/guarded.d.ts
/**
 * The guard → deny → execute → capture sequence shared by `guardTool()` and
 * `guardAction()`. Callers resolve `rules`, `metadata`, and `correlationId`
 * (including any per-input functions and overrides) and pass the final values;
 * this runs the common flow:
 *
 * 1. Call `guard()` — always, including when `rules` is omitted or empty, which
 *    is sent as `[]`. Both guard-unavailable signals (threw and failed-open)
 *    are governed by `onGuardError`: with `"deny"` (the default), both trigger
 *    `onUnavailable` without executing; with `"allow"`, both fail open and
 *    proceed to execute.
 * 2. On DENY, capture `outcome: "denied"` and return `onDeny(decision)`.
 * 3. Otherwise run `execute()`, capturing `outcome: "success"` — or, if it
 *    throws, `outcome: "error"` before rethrowing.
 *
 * `onDeny` returns the value the caller hands back on denial (`guardTool`
 * returns an `ArcjetDenialResult`; `guardAction` throws, and its `never`
 * return type is assignable to `T`).
 */
declare function runGuarded<T>(client: ArcjetAgentClient, params: {
  action: string;
  rules: RuleWithInput[] | undefined;
  correlationId: string | undefined;
  metadata: ArcjetMetadata;
  actor?: string;
  inputs?: PolicyInputMap;
  resolvePolicy?: () => Promise<{
    actor?: string;
    inputs?: PolicyInputMap;
  }>;
  onDeny: (decision: DecisionDeny) => T;
  onUnavailable: (unavailable: {
    kind: "threw";
    error: unknown;
  } | {
    kind: "failed-open";
    decision: DecisionAllow;
  }) => T;
  execute: () => Promise<T>;
  onGuardError?: "allow" | "deny";
}): Promise<T>;
//#endregion
export { runGuarded };