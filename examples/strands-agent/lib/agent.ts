import {
  guardHooks,
  guardTool,
  strandsAgentContext,
  type StrandsAgentContext,
} from "@arcjet/guard/strands-agents/v1";
import { Agent, tool } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { z } from "zod";
import {
  arcjet,
  detectInjection,
  detectPii,
  lookupLimit,
  warehouseLimit,
} from "./arcjet.ts";

const LOOKUP_ORDER_TOOL = "lookup_order";
const NOTIFY_WAREHOUSE_TOOL = "notify_warehouse";

const GUARD_UNAVAILABLE =
  "Arcjet security check could not be completed; please retry later.";

const SYSTEM_PROMPT =
  "You are a support agent. Use lookup_order for order questions and " +
  "notify_warehouse when the user asks to notify the warehouse. " +
  "If a tool call is denied by security policy, do not retry it; explain " +
  "the denial to the user or try a different approach.";

// Authored tool: wrap tool({ callback }). DENY is a plain ArcjetDenialResult
// — do not throw. Do not call event.interrupt(). Prefer omitting
// outputSchema so the denial object can traverse the tool loop.
const lookupOrder = guardTool(
  arcjet,
  tool({
    name: LOOKUP_ORDER_TOOL,
    description:
      "Look up an order by ID. Include a note when the user supplies one.",
    inputSchema: z.object({
      orderId: z.string(),
      note: z.string().optional(),
    }),
    callback: async ({ orderId, note }) => ({
      orderId,
      status: "shipped",
      carrier: "ACME Post",
      eta: "2 days",
      ...(note ? { note } : {}),
    }),
  }),
  {
    action: "order.looked-up",
    onGuardError: "deny",
    rules: (input) => {
      const { orderId, note } = readLookupInput(input);
      return [
        lookupLimit({ key: `order:${orderId}`, requested: 1 }),
        ...(note !== undefined ? [detectPii(note)] : []),
      ];
    },
  },
);

// Unwrapped tool: gated by guardHooks BeforeToolCallEvent.cancel, not
// guardTool. Do not also wrap this with @arcjet/guard/vercel-ai/v7 or
// @arcjet/guard/langgraph/v1.
const notifyWarehouse = tool({
  name: NOTIFY_WAREHOUSE_TOOL,
  description: "Notify the warehouse that an order is ready to pick.",
  inputSchema: z.object({
    orderId: z.string(),
  }),
  callback: async ({ orderId }) => ({
    orderId,
    notified: true,
    destination: "warehouse",
  }),
});

export interface AgentRunInput {
  prompt: string;
  /**
   * Caller-owned conversation id. Copied onto invoke({ invocationState }).
   * Never minted. Never traceId. Never agent.id.
   */
  sessionId?: string;
}

export interface AgentRunResult {
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string };
  correlationId?: string;
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const invocationState =
    input.sessionId === undefined ? {} : { sessionId: input.sessionId };
  // Derived once and reused: strandsAgentContext reads invocationState
  // and never mints an id. Never read traceId or agent.id. Do not call
  // createAgentContext or SessionManager.
  const ctx = strandsAgentContext({ invocationState });

  // No guardInbound. Screen before invoke() / stream(). Middleware /
  // model hooks are not this policy gate. guard() fails open — check
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

  const model = openAiModel();
  const agent = new Agent({
    systemPrompt: SYSTEM_PROMPT,
    model,
    tools: [lookupOrder, notifyWarehouse],
    // event.interrupt() is HITL, not a policy gate. Same trap as Mastra
    // requireApproval, Claude canUseTool, LangGraph interrupt(), and
    // OpenAI Agents needsApproval. There is no guardApproval. Policy
    // sits on BeforeToolCallEvent.cancel only. Do not set
    // BeforeToolsEvent.cancel — that skips per-tool hooks.
    plugins: [
      // Brand-aware: skips lookup_order (already guardTool). Gates
      // notify_warehouse and any MCP / vended tool. Pass as a Plugin on
      // new Agent({ plugins }) — do not pass guardHooks() to addHook.
      guardHooks(arcjet, {
        action: ({ toolName }) => `${toolName}.invoked`,
        onGuardError: "deny",
        sessionId: input.sessionId,
        rules: ({ toolName, input: toolInput }) => {
          if (toolName !== NOTIFY_WAREHOUSE_TOOL) {
            return [];
          }
          const orderId = readOrderId(toolInput) ?? toolName;
          return [warehouseLimit({ key: `order:${orderId}`, requested: 1 })];
        },
      }),
    ],
  });

  const result = await agent.invoke(input.prompt, { invocationState });

  return {
    message: readAgentText(result),
    toolResults: collectToolResults(agent),
    correlationId: ctx.correlationId,
  };
}

async function screenInbound(
  text: string,
  ctx: StrandsAgentContext,
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
    if (decision.hasFailedOpen()) {
      return { reason: "ERROR", message: GUARD_UNAVAILABLE };
    }
    return undefined;
  } catch {
    return { reason: "ERROR", message: GUARD_UNAVAILABLE };
  }
}

function readAgentText(result: unknown): string {
  if (typeof result === "object" && result !== null && "toString" in result) {
    const text = (result as { toString(): string }).toString();
    if (text.length > 0) {
      return text;
    }
  }
  if (typeof result === "string") {
    return result;
  }
  return "";
}

function collectToolResults(agent: Agent): unknown[] {
  const namesById = new Map<string, string>();
  const results: unknown[] = [];
  for (const message of agent.messages) {
    for (const block of message.content) {
      if (block.type === "toolUseBlock") {
        namesById.set(block.toolUseId, block.name);
        continue;
      }
      if (block.type !== "toolResultBlock") {
        continue;
      }
      const payload = readToolResultPayload(block.content);
      results.push({
        name: namesById.get(block.toolUseId) ?? "unknown",
        arcjetDenied: isArcjetDenial(payload),
        content: payload,
      });
    }
  }
  return results;
}

function readToolResultPayload(content: ReadonlyArray<{ type?: string }>): unknown {
  const parts: unknown[] = [];
  for (const item of content) {
    if (item.type === "jsonBlock" && "json" in item) {
      parts.push(item.json);
      continue;
    }
    if (item.type === "textBlock" && "text" in item && typeof item.text === "string") {
      parts.push(parseJsonIfString(item.text));
    }
  }
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length > 1) {
    return parts;
  }
  return content;
}

function parseJsonIfString(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isArcjetDenial(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "arcjetDenied" in value &&
    value.arcjetDenied === true
  );
}

function openAiModel() {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const apiKey = gatewayKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }
  return new OpenAIModel({
    api: "chat",
    modelId: process.env.STRANDS_MODEL ?? "gpt-4o-mini",
    apiKey,
    ...(gatewayKey
      ? { clientConfig: { baseURL: "https://ai-gateway.vercel.sh/v1" } }
      : {}),
  });
}

function readLookupInput(input: unknown): { orderId: string; note?: string } {
  const orderId = readOrderId(input) ?? LOOKUP_ORDER_TOOL;
  if (typeof input !== "object" || input === null || !("note" in input)) {
    return { orderId };
  }
  const { note } = input as { note: unknown };
  return typeof note === "string" && note.length > 0 ? { orderId, note } : { orderId };
}

function readOrderId(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("orderId" in input)) {
    return undefined;
  }
  const { orderId } = input as { orderId: unknown };
  return typeof orderId === "string" && orderId.length > 0 ? orderId : undefined;
}
