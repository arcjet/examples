/**
 * Local declarations for the unpublished `@arcjet/guard/claude-agent-sdk/v0`
 * adapter.
 *
 * The adapter is not on npm. These signatures match
 * `arcjet/arcjet-js` branch `david/cursor/guard-claude-agent-sdk-v0-16a6`
 * at SHA `69dd601018e39e649d473645246da438c42b01cc`.
 *
 * They exist so this example typechecks against the specified API without
 * inventing a published version number. To typecheck and run against the
 * real package instead of this shim, clone that branch, build
 * `arcjet-guard`, and replace the `@arcjet/guard` dependency:
 *
 * ```json
 * "@arcjet/guard": "file:../../../arcjet-js/arcjet-guard"
 * ```
 *
 * Then remove the `paths` mapping in `tsconfig.json`. Do not publish or
 * pin a made-up `@arcjet/guard` version for this subpath.
 */
import type {
  HookCallbackMatcher,
  HookEvent,
} from "@anthropic-ai/claude-agent-sdk";

export interface ClaudeContextSource {
  session_id?: unknown;
  sessionId?: unknown;
  agent_id?: unknown;
  agent_type?: unknown;
}

export interface ClaudeAgentContext {
  correlationId?: string;
  metadata?: Record<string, string>;
}

export interface ClaudeToolDefinition<TInput = unknown> {
  name: string;
  description: string;
  inputSchema: unknown;
  handler: (args: TInput, extra: unknown) => Promise<unknown>;
  annotations?: unknown;
  _meta?: Record<string, unknown>;
}

export type ClaudeToolInput<TTool> = TTool extends {
  handler: (args: infer TInput, extra: unknown) => Promise<unknown>;
}
  ? TInput
  : never;

export type OnGuardError = "deny" | "allow";

export interface GuardToolPolicy<TInput> {
  action: string;
  rules?: unknown[] | ((input: TInput) => unknown[]);
  metadata?:
    | Record<string, string>
    | ((input: TInput) => Record<string, string>);
  sessionId?: string | ((input: TInput) => string | undefined);
  onGuardError?: OnGuardError;
  onDeny?: (decision: { reason: string }) => unknown;
}

export interface GuardHooksCall {
  toolName: string;
  input: unknown;
}

export interface GuardHooksInbound {
  prompt: string;
}

export interface GuardHooksInboundPolicy {
  action?: string | ((input: GuardHooksInbound) => string);
  rules?: unknown[] | ((input: GuardHooksInbound) => unknown[]);
  metadata?:
    | Record<string, string>
    | ((input: GuardHooksInbound) => Record<string, string>);
  onGuardError?: OnGuardError;
}

export interface GuardHooksPolicy {
  sessionId?: string;
  action?: string | ((call: GuardHooksCall) => string);
  rules?: unknown[] | ((call: GuardHooksCall) => unknown[]);
  metadata?:
    | Record<string, string>
    | ((call: GuardHooksCall) => Record<string, string>);
  onGuardError?: OnGuardError;
  inbound?: GuardHooksInboundPolicy;
}

export interface ArcjetDenialResult {
  arcjetDenied: true;
  reason: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

export interface ClaudeCallToolResult {
  content: Array<{
    type: "text" | "image" | "audio" | "resource" | "resource_link";
    text?: string;
    [key: string]: unknown;
  }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export function claudeAgentContext(
  source?: ClaudeContextSource,
  init?: { sessionId?: string; metadata?: Record<string, string> },
): ClaudeAgentContext;

export function guardTool<TTool extends ClaudeToolDefinition<any>>(
  client: unknown,
  tool: TTool,
  policy: GuardToolPolicy<ClaudeToolInput<TTool>>,
): TTool;

export function guardHooks(
  client: unknown,
  policy?: GuardHooksPolicy,
): Partial<Record<HookEvent, HookCallbackMatcher[]>>;
