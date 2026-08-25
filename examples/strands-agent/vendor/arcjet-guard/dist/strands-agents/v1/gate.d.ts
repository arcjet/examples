import { ArcjetMetadata } from "../../metadata.js";
import { DecisionAllow, DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
//#region src/strands-agents/v1/gate.d.ts
/**
 * The guard → capture sequence for a call site that decides whether something
 * may run but does not run it. Shared by `guardHooks` on
 * `BeforeToolCallEvent`.
 *
 * The allow outcome is `"allowed"`, not `"success"` — a distinction that
 * keeps "the tool ran" and "the tool was permitted to run" separate.
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