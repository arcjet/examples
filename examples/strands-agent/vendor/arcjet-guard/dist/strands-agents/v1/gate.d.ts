import type { ArcjetAgentClient } from "../../agents/capture.ts";
import type { ArcjetMetadata, DecisionAllow, DecisionDeny, RuleWithInput } from "../../types.ts";
/**
 * The guard → capture sequence for a call site that decides whether something
 * may run but does not run it. Shared by `guardHooks` on
 * `BeforeToolCallEvent`.
 *
 * The allow outcome is `"allowed"`, not `"success"` — a distinction that
 * keeps "the tool ran" and "the tool was permitted to run" separate.
 */
export declare function runGate<T>(client: ArcjetAgentClient, params: {
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
