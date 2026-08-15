import { DecisionDeny } from "../../types.js";
//#region src/claude-agent-sdk/v0/denial.d.ts
/**
 * Structured denial payload returned to the model (as `structuredContent` on
 * a `CallToolResult`, or as the PreToolUse / UserPromptSubmit reason).
 *
 * Intentionally structurally identical to `vercel-ai/v7`'s ArcjetDenialResult
 * so the model trained on denial objects sees the same shape regardless of
 * which integration is in use. Both declarations exist to avoid putting the
 * `ai` SDK in this namespace's import graph.
 */
interface ArcjetDenialResult {
  arcjetDenied: true;
  /** Denial reason, e.g. `"RATE_LIMIT"` or `"PROMPT_INJECTION"`. */
  reason: string;
  /** Human/model-readable explanation of the denial. */
  message: string;
  /** Whether retrying later can succeed (true for rate limits). */
  retryable: boolean;
  /** Seconds until a rate-limited call may be retried. */
  retryAfterSeconds?: number;
}
/**
 * MCP `CallToolResult` shape the Claude Agent SDK's `tool()` handler must
 * return. Declared structurally so this module never value-imports the SDK
 * (or `@modelcontextprotocol/sdk`, which does not re-export `CallToolResult`
 * from `@anthropic-ai/claude-agent-sdk`).
 */
interface ClaudeCallToolResult {
  content: Array<{
    type: "text" | "image" | "audio" | "resource" | "resource_link";
    text?: string;
    [key: string]: unknown;
  }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}
/** Model- and user-readable explanation of a denial. */
declare function deniedReason(decision: DecisionDeny): string;
/** Explanation used when the policy could not be evaluated. */
declare function unavailableReason(): string;
/**
 * Backoff hint returned to the model when the guard is unavailable.
 *
 * A rate-limit denial derives its hint from the denying rule's
 * `resetAtUnixSeconds`. This path has nothing to derive from. Five seconds
 * paces a model's retry loop.
 */
declare const UNAVAILABLE_RETRY_AFTER_SECONDS: number;
declare function denialResult(decision: DecisionDeny): ArcjetDenialResult;
declare function unavailableResult(): ArcjetDenialResult;
/**
 * DENY as a `CallToolResult` with `isError: true`. Prefer this over throwing:
 * Claude reads the composed message instead of a raw exception.
 */
declare function denialCallToolResult(decision: DecisionDeny): ClaudeCallToolResult;
declare function unavailableCallToolResult(): ClaudeCallToolResult;
/**
 * Coerce an `onDeny` return value into a `CallToolResult`. A value that
 * already has a `content` array is used as-is; any other object becomes
 * `structuredContent` on an `isError: true` result.
 */
declare function asCallToolResult(value: unknown, fallback: ClaudeCallToolResult): ClaudeCallToolResult;
//#endregion
export { ArcjetDenialResult, ClaudeCallToolResult, UNAVAILABLE_RETRY_AFTER_SECONDS, asCallToolResult, denialCallToolResult, denialResult, deniedReason, unavailableCallToolResult, unavailableReason, unavailableResult };