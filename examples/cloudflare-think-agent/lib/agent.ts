import {
  cloudflareThinkContext,
  guardHooks,
  type CloudflareThinkAgentContext,
  type CloudflareThinkGuardHooks,
} from "@arcjet/guard/cloudflare-think/v0";
import {
  arcjet,
  detectInjection,
  detectPii,
  lookupLimit,
} from "./arcjet.ts";

const LOOKUP_ORDER_TOOL = "lookup_order";

const GUARD_UNAVAILABLE =
  "Arcjet security check could not be completed; please retry later.";

const SYSTEM_PROMPT =
  "You are a support agent. Use lookup_order for order questions. " +
  "If a tool call is denied by security policy, do not retry it; explain " +
  "the denial to the user or try a different approach.";

const LOOKUP_ORDER_DESCRIPTION =
  "Look up an order by ID. Include a note when the user supplies one.";

export interface AgentRunInput {
  prompt: string;
  /**
   * Caller-owned conversation / session id. Copied onto helper options
   * (`guardHooks({ sessionId })`) and
   * `cloudflareThinkContext({ context: { sessionId } })`. Never minted.
   * Never `toolCallId`. Never a Durable Object `name` / `id`. Never
   * `traceId`.
   */
  sessionId?: string;
}

export interface AgentRunResult {
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string };
  correlationId?: string;
}

/**
 * Official Cloudflare Think wiring. A production Worker subclasses
 * `Think` and delegates `beforeToolCall` to `guardHooks` — that is the
 * deny point. This example runs the same hook from a local harness
 * because `@cloudflare/think` imports the `cloudflare:` runtime and
 * cannot be constructed on Node.
 *
 *   import { Think } from "@cloudflare/think";
 *   const hooks = createGuardHooks(conversationId);
 *   export class SupportAgent extends Think<Env> {
 *     beforeToolCall(ctx) {
 *       return hooks.beforeToolCall(ctx);
 *     }
 *   }
 *
 * Do not also wrap with `@arcjet/guard/vercel-ai/v7`. Think already
 * re-wraps `execute`. There is no `guardTool`. Skip is the hook return,
 * not throw-from-execute. Client tools and tools with no local
 * `execute` are out of scope.
 *
 * needsApproval is HITL, not a policy gate. Same trap as Mastra
 * requireApproval, Claude canUseTool, LangGraph interrupt(), Genkit
 * toolApproval, OpenAI Agents needsApproval, LangChain
 * humanInTheLoopMiddleware, TanStack needsApproval, and Google ADK
 * requireConfirmation. There is no guardApproval. After a human yes,
 * Guard still evaluates when beforeToolCall runs. Do not install
 * needsApproval as the policy gate.
 */
export function createGuardHooks(sessionId?: string) {
  // Default DENY is { action: "substitute", output: ArcjetDenialResult }
  // so the tool never runs and the model sees the payload. Optional
  // onDeny: "block" returns { action: "block", reason } — shown here
  // as a comment, not the default. onDeny: "block" applies to real
  // DENY only; unavailable stays substitute. The hook does not throw.
  //
  //   guardHooks(arcjet, { onDeny: "block", ... })
  //
  return guardHooks(arcjet, {
    action: ({ toolName }) => `${toolName}.invoked`,
    sessionId,
    // Default is already deny; set it explicitly so tool-call
    // outages fail closed via substitute-deny.
    onGuardError: "deny",
    rules: ({ toolName, input: args }) => {
      if (toolName !== LOOKUP_ORDER_TOOL) {
        return [];
      }
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

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const appContext =
    input.sessionId === undefined ? {} : { sessionId: input.sessionId };
  // Derived once and reused: cloudflareThinkContext reads helper
  // options / a caller-owned wrap and never mints an id. Never read
  // toolCallId, a Durable Object name / id, or traceId. Do not call
  // createAgentContext.
  const ctx = cloudflareThinkContext({ context: appContext });

  // No guardInbound. Screen before chat() / saveMessages().
  // guard() fails open — check hasFailedOpen().
  const inbound = await screenInbound(input.prompt, ctx);
  if (inbound !== undefined) {
    return {
      message: inbound.message,
      toolResults: [],
      inboundBlocked: { reason: inbound.reason },
      correlationId: ctx.correlationId,
    };
  }

  const hooks = createGuardHooks(input.sessionId);
  const toolResults: unknown[] = [];
  const message = await runThinkTurn({
    prompt: input.prompt,
    beforeToolCall: hooks.beforeToolCall,
    onToolResult: (result) => {
      toolResults.push(result);
    },
  });

  return {
    message,
    toolResults,
    correlationId: ctx.correlationId,
  };
}

async function screenInbound(
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
  } catch (error) {
    console.error("Inbound guard failed:", error);
    return { reason: "ERROR", message: GUARD_UNAVAILABLE };
  }
}

/**
 * Local stand-in for Think's agentic loop. Production uses
 * `SupportAgent.chat()`; Think wraps `execute` and consults
 * `beforeToolCall` first. This harness calls the same hook and
 * applies Think 0.3+ `ToolCallDecision` the same way: void /
 * `{ action: "allow" }` runs execute; `{ action: "substitute" }`
 * / `{ action: "block" }` skip it.
 */
async function runThinkTurn(input: {
  prompt: string;
  beforeToolCall: CloudflareThinkGuardHooks["beforeToolCall"];
  onToolResult: (result: {
    name: string;
    arcjetDenied: boolean;
    content: unknown;
  }) => void;
}): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: input.prompt },
  ];

  for (let step = 0; step < 8; step += 1) {
    const response = await chatCompletions(messages);
    const toolCalls = response.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return response.content ?? "";
    }

    messages.push({
      role: "assistant",
      content: response.content,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const toolName = call.function.name;
      const args = parseToolArgs(call.function.arguments);
      // Think always mints toolCallId. Pass it on the envelope so
      // cloudflareThinkContext treats this as a Think tool-call
      // context and ignores top-level sessionId / toolCallId.
      const decision = await input.beforeToolCall(
        thinkToolCallContext(call.id, toolName, args),
      );
      const output = applyThinkDecision(decision, args, executeLookupOrder);
      input.onToolResult({
        name: toolName,
        arcjetDenied: isArcjetDenial(output),
        content: output,
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: stringifyToolOutput(output),
      });
    }
  }

  return "The agent stopped before producing a final reply.";
}

function thinkToolCallContext(
  toolCallId: string,
  toolName: string,
  input: unknown,
): Parameters<CloudflareThinkGuardHooks["beforeToolCall"]>[0] {
  // Structural Think ToolCallContext. toolCallId is required on the
  // envelope and is never used for correlation.
  return {
    type: "tool-call",
    toolCallId,
    toolName,
    input,
  } as Parameters<CloudflareThinkGuardHooks["beforeToolCall"]>[0];
}

function executeLookupOrder(input: unknown): unknown {
  const orderId = readOrderId(input) ?? "unknown";
  const note = readNote(input);
  return {
    orderId,
    status: "shipped",
    carrier: "ACME Post",
    eta: "2 days",
    ...(note ? { note } : {}),
  };
}

/**
 * Think 0.3+ `_resolveToolCallDecision`: void / `{ action: "allow" }`
 * runs `execute`; `block` / `substitute` skip it.
 */
function applyThinkDecision(
  decision: unknown,
  input: unknown,
  execute: (input: unknown) => unknown,
): unknown {
  if (decision === undefined || decision === null) {
    return execute(input);
  }
  if (typeof decision !== "object" || !("action" in decision)) {
    return execute(input);
  }
  const record = decision as {
    action: string;
    input?: unknown;
    reason?: string;
    output?: unknown;
  };
  if (record.action === "allow") {
    return execute(record.input ?? input);
  }
  if (record.action === "block") {
    return record.reason ?? "Tool call blocked";
  }
  if (record.action === "substitute") {
    return record.output;
  }
  return execute(input);
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ChatCompletionMessage {
  content?: string | null;
  tool_calls?: ChatToolCall[];
}

async function chatCompletions(
  messages: ChatMessage[],
): Promise<ChatCompletionMessage> {
  const { apiKey, baseURL, model } = modelConfig();
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: LOOKUP_ORDER_TOOL,
            description: LOOKUP_ORDER_DESCRIPTION,
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                orderId: { type: "string" },
                note: { type: "string" },
              },
              required: ["orderId"],
            },
          },
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Model request failed (${response.status}): ${detail.slice(0, 400)}`,
    );
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: ChatCompletionMessage }>;
  };
  const message = body.choices?.[0]?.message;
  if (message === undefined) {
    throw new Error("Model response did not include a message");
  }
  return message;
}

function modelConfig(): { apiKey: string; baseURL: string; model: string } {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const apiKey = gatewayKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY or OPENAI_API_KEY is required");
  }
  return {
    apiKey,
    baseURL: gatewayKey
      ? "https://ai-gateway.vercel.sh/v1"
      : "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  };
}

function parseToolArgs(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

function stringifyToolOutput(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function isArcjetDenial(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "arcjetDenied" in value &&
    value.arcjetDenied === true
  );
}

function readOrderId(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("orderId" in input)) {
    return undefined;
  }
  const { orderId } = input as { orderId: unknown };
  return typeof orderId === "string" && orderId.length > 0
    ? orderId
    : undefined;
}

function readNote(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("note" in input)) {
    return undefined;
  }
  const { note } = input as { note: unknown };
  return typeof note === "string" && note.length > 0 ? note : undefined;
}
