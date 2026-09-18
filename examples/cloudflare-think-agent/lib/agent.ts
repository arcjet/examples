import {
  cloudflareThinkContext,
  guardHooks,
  type CloudflareThinkAgentContext,
  type CloudflareThinkGuardHooks,
} from "@arcjet/guard/cloudflare-think/v0";
import { policyInput } from "@arcjet/guard";
import type { ToolCallContext, ToolCallDecision } from "@cloudflare/think";
import { arcjet, detectInjection, detectPii, lookupLimit } from "./arcjet.ts";

export const LOOKUP_ORDER_TOOL = "lookup_order";

const GUARD_UNAVAILABLE =
  "Arcjet security check could not be completed; please retry later.";

export const SYSTEM_PROMPT =
  "You are a support agent. Use lookup_order for order questions. " +
  "If a tool call is denied by security policy, do not retry it; explain " +
  "the denial to the user or try a different approach.";

const TRUSTED_ACTOR = "demo-user";

export interface AgentRunInput {
  prompt: string;
  /**
   * Caller-owned conversation / session id. Copied onto
   * `cloudflareThinkContext({ context: { sessionId } })` and
   * `guardHooks({ sessionId })`. Never minted. Never `toolCallId`.
   * Never Durable Object `name` / `id`. Never `requestId` / `traceId`.
   */
  sessionId?: string;
  /**
   * Optional Think DENY delivery. Default substitute so the model sees
   * `ArcjetDenialResult`. `"block"` returns `{ action: "block", reason }`.
   */
  onDeny?: "block";
}

export interface AgentRunResult {
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string };
  correlationId?: string;
}

/**
 * Think `beforeToolCall` gate. There is no `guardTool`. Assign
 * `hooks.beforeToolCall` on a `Think` subclass — see `src/server.ts`.
 * Default DENY is `{ action: "substitute", output: ArcjetDenialResult }`.
 * Optional `onDeny: "block"` is real DENY only; unavailable stays
 * substitute.
 */
export function createGuardHooks(
  sessionId?: string,
  onDeny?: "block",
): CloudflareThinkGuardHooks {
  return guardHooks(arcjet, {
    action: ({ toolName }) => `${toolName}.invoked`,
    // Trusted server-side actor — never a model-produced tool argument.
    actor: TRUSTED_ACTOR,
    // Named remote-policy inputs. A dashboard policy that declares
    // these names can evaluate; omit them and those rules do not fire.
    inputs: ({ input: args }) => {
      const orderId = readOrderId(args) ?? LOOKUP_ORDER_TOOL;
      const note = readNote(args);
      return {
        order_id: policyInput.server.string(orderId),
        actor: policyInput.server.string(TRUSTED_ACTOR),
        ...(note !== undefined ? { note: policyInput.local.string(note) } : {}),
      };
    },
    sessionId,
    onGuardError: "deny",
    ...(onDeny === "block" ? { onDeny: "block" as const } : {}),
    //   guardHooks(arcjet, { onDeny: "block", ... })
    rules: ({ input: args }) => {
      const orderId = readOrderId(args) ?? LOOKUP_ORDER_TOOL;
      const note = readNote(args);
      return [
        lookupLimit({ key: `order:${orderId}`, requested: 1 }),
        // Scan free-text args only. An opaque orderId will not
        // trip EMAIL / phone / card / IP.
        ...(note !== undefined ? [detectPii(note)] : []),
      ];
    },
  });
}

export function lookupOrderRecord(orderId: string, note?: string) {
  return {
    orderId,
    status: "shipped",
    carrier: "ACME Post",
    eta: "2 days",
    ...(note ? { note } : {}),
  };
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const appContext =
    input.sessionId === undefined ? {} : { sessionId: input.sessionId };
  // Derived once and reused: cloudflareThinkContext reads helper
  // options / a wrap and never mints an id. Never read toolCallId,
  // requestId, traceId, or Durable Object name / id. Do not call
  // createAgentContext.
  const ctx = cloudflareThinkContext({ context: appContext });

  // No guardInbound. Screen before the Think turn. needsApproval is
  // HITL, not this policy gate. guard() fails open — check
  // hasFailedOpen().
  const inbound = await screenInbound(input.prompt, ctx);
  if (inbound !== undefined) {
    return {
      message: inbound.message,
      toolResults: [],
      inboundBlocked: { reason: inbound.reason },
      correlationId: ctx.correlationId,
    };
  }

  const hooks = createGuardHooks(input.sessionId, input.onDeny);
  const toolInput = toolInputFromPrompt(input.prompt);
  const toolCtx = demoToolCallContext(LOOKUP_ORDER_TOOL, toolInput);
  const decision = await hooks.beforeToolCall(toolCtx);
  const toolResults = [await applyToolDecision(decision, toolInput)];

  return {
    message: messageFromToolResults(toolResults),
    toolResults,
    correlationId: ctx.correlationId,
  };
}

export async function screenInbound(
  text: string,
  ctx: CloudflareThinkAgentContext,
): Promise<{ reason: string; message: string } | undefined> {
  try {
    const decision = await arcjet.guard({
      label: "message.received",
      rules: [detectInjection(text)],
      ...ctx,
    });
    if (decision.conclusion === "DENY") {
      return {
        reason: decision.reason,
        message: `Arcjet denied this call (${decision.reason}). Do not retry; explain the denial to the user or try a different approach.`,
      };
    }
    // guard() fails open. An ALLOW the guard could not actually
    // evaluate must be checked — otherwise untrusted text reaches
    // the model.
    if (decision.hasFailedOpen()) {
      return { reason: "ERROR", message: GUARD_UNAVAILABLE };
    }
    return undefined;
  } catch {
    return { reason: "ERROR", message: GUARD_UNAVAILABLE };
  }
}

function demoToolCallContext(
  toolName: string,
  input: { orderId: string; note?: string },
): ToolCallContext {
  // Think always mints toolCallId. cloudflareThinkContext ignores it.
  return {
    type: "tool-call",
    toolName,
    toolCallId: "demo-tool-call",
    input,
    messages: [],
    abortSignal: undefined,
    stepNumber: 0,
  } as ToolCallContext;
}

async function applyToolDecision(
  decision: ToolCallDecision | void,
  input: { orderId: string; note?: string },
): Promise<unknown> {
  if (decision === undefined || decision.action === "allow") {
    const allowedInput =
      decision?.action === "allow" && decision.input !== undefined
        ? (asToolInput(decision.input) ?? input)
        : input;
    const content = lookupOrderRecord(allowedInput.orderId, allowedInput.note);
    return {
      name: LOOKUP_ORDER_TOOL,
      arcjetDenied: false,
      action: "allow",
      content,
    };
  }

  if (decision.action === "block") {
    return {
      name: LOOKUP_ORDER_TOOL,
      arcjetDenied: true,
      action: "block",
      content: { reason: decision.reason },
    };
  }

  return {
    name: LOOKUP_ORDER_TOOL,
    arcjetDenied: isArcjetDenial(decision.output),
    action: "substitute",
    content: decision.output,
  };
}

function messageFromToolResults(toolResults: unknown[]): string {
  const denied = toolResults.find(isDeniedToolResult);
  if (denied !== undefined) {
    if (
      isRecord(denied.content) &&
      typeof denied.content.message === "string"
    ) {
      return denied.content.message;
    }
    if (
      isRecord(denied.content) &&
      typeof denied.content.reason === "string" &&
      denied.content.reason.startsWith("Arcjet denied")
    ) {
      return denied.content.reason;
    }
    const reason = denialReason(denied.content);
    return `Arcjet denied this call (${reason}). Do not retry; explain the denial to the user or try a different approach.`;
  }
  const allowed = toolResults[0];
  if (isRecord(allowed) && isRecord(allowed.content)) {
    return `Order ${String(allowed.content.orderId)} is ${String(allowed.content.status)} via ${String(allowed.content.carrier)} (ETA ${String(allowed.content.eta)}).`;
  }
  return "Looked up the order.";
}

function toolInputFromPrompt(prompt: string): {
  orderId: string;
  note?: string;
} {
  const orderMatch = /order\s+([A-Za-z0-9_-]+)/i.exec(prompt);
  const noteMatch = /note:\s*(.+)$/i.exec(prompt);
  const note = noteMatch?.[1]?.trim();
  return {
    orderId: orderMatch?.[1] ?? "42",
    ...(note !== undefined && note.length > 0 ? { note } : {}),
  };
}

function asToolInput(
  value: unknown,
): { orderId: string; note?: string } | undefined {
  const orderId = readOrderId(value);
  if (orderId === undefined) {
    return undefined;
  }
  const note = readNote(value);
  return { orderId, ...(note !== undefined ? { note } : {}) };
}

function isDeniedToolResult(
  value: unknown,
): value is { arcjetDenied: true; content: unknown } {
  return isRecord(value) && value.arcjetDenied === true;
}

function denialReason(content: unknown): string {
  if (isRecord(content) && typeof content.reason === "string") {
    return content.reason;
  }
  return "DENIED";
}

function isArcjetDenial(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "arcjetDenied" in value &&
    value.arcjetDenied === true
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readOrderId(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("orderId" in input)) {
    return undefined;
  }
  const { orderId } = input as { orderId: unknown };
  return typeof orderId === "string" && orderId.length > 0
    ? orderId
    : undefined;
}

export function readNote(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("note" in input)) {
    return undefined;
  }
  const { note } = input as { note: unknown };
  return typeof note === "string" && note.length > 0 ? note : undefined;
}
