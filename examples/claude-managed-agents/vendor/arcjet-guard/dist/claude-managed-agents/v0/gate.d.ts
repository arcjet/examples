import { ArcjetMetadata } from "../../metadata.js";
import { DecisionAllow, DecisionDeny, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
//#region src/claude-managed-agents/v0/gate.d.ts
/**
 * Permit-only gate for inbound Managed Agents events. Shared by `guardEvents`.
 * Does not execute the send — the allow tail means "permitted to send".
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