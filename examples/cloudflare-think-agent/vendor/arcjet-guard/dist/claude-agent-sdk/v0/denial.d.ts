import { DecisionDeny } from "../../types.js";
//#region src/claude-agent-sdk/v0/denial.d.ts
/**
 * MCP `CallToolResult` shape the Claude Agent SDK's `tool()` handler must
 * return. Declared structurally so this module never value-imports the SDK
 * (or `@modelcontextprotocol/sdk`, which does not re-export `CallToolResult`
 * from `@anthropic-ai/claude-agent-sdk`).
 */
export interface ClaudeCallToolResult {
  content: Array<{
    type: "text" | "image" | "audio" | "resource" | "resource_link";
    text?: string;
    [key: string]: unknown;
  }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}
/**
 * DENY as a `CallToolResult` with `isError: true`. Prefer this over throwing:
 * Claude reads the composed message instead of a raw exception, and omitting
 * `isError` would look like a successful tool call. The payload carried on
 * `structuredContent` is the shared contract from `agents/denial.ts`.
 */
export declare function denialCallToolResult(decision: DecisionDeny): ClaudeCallToolResult;
export declare function unavailableCallToolResult(): ClaudeCallToolResult;
/**
 * Coerce an `onDeny` return value into a `CallToolResult`. A value that
 * already has a `content` array is used as-is; any other object becomes
 * `structuredContent` on an `isError: true` result.
 */
export declare function asCallToolResult(value: unknown, fallback: ClaudeCallToolResult): ClaudeCallToolResult;
//#endregion