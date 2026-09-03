import {
  guardTool,
  openaiAgentsContext,
  type OpenAIAgentsAgentContext,
} from "@arcjet/guard/openai-agents/v0";
import { OpenAIProvider } from "@openai/agents-openai";
import { Agent, run, setDefaultModelProvider, tool } from "@openai/agents";
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

// Authored tool: wrap FunctionTool.invoke after tool({ execute }). DENY is a
// plain ArcjetDenialResult — do not throw. A throw hits errorFunction /
// ToolCallError and drops the fields. The runner stringifies the payload
// onto a function_call_result with status: "completed".
const lookupOrder = guardTool(
  arcjet,
  tool({
    name: LOOKUP_ORDER_TOOL,
    description:
      "Look up an order by ID. Include a note when the user supplies one.",
    parameters: z.object({
      orderId: z.string(),
      note: z.string().optional(),
    }),
    execute: async ({ orderId, note }) => ({
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

// There is no guardHooks / guardToolNode. Hosted tools, MCP, handoffs,
// and agent.asTool() skip authored invoke. Every authored tool you want
// gated must be wrapped with guardTool. Do not also wrap these with
// @arcjet/guard/vercel-ai/v7.
const notifyWarehouse = guardTool(
  arcjet,
  tool({
    name: NOTIFY_WAREHOUSE_TOOL,
    description: "Notify the warehouse that an order is ready to pick.",
    parameters: z.object({
      orderId: z.string(),
    }),
    execute: async ({ orderId }) => ({
      orderId,
      notified: true,
      destination: "warehouse",
    }),
  }),
  {
    action: "warehouse.notified",
    onGuardError: "deny",
    rules: (input) => {
      const orderId = readOrderId(input) ?? NOTIFY_WAREHOUSE_TOOL;
      return [warehouseLimit({ key: `order:${orderId}`, requested: 1 })];
    },
  },
);

function createSupportAgent() {
  return new Agent({
    name: "support-agent",
    instructions: SYSTEM_PROMPT,
    model: process.env.OPENAI_AGENTS_MODEL ?? "gpt-4o-mini",
    tools: [lookupOrder, notifyWarehouse],
    // needsApproval / hosted requireApproval is HITL, not a policy gate.
    // Same trap as Mastra requireApproval, Claude canUseTool, and
    // LangGraph interrupt(). There is no guardApproval.
  });
}

let providerConfigured = false;

function ensureModelProvider() {
  if (providerConfigured) {
    return;
  }
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const apiKey = gatewayKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }
  setDefaultModelProvider(
    new OpenAIProvider({
      apiKey,
      ...(gatewayKey
        ? { baseURL: "https://ai-gateway.vercel.sh/v1" }
        : {}),
    }),
  );
  providerConfigured = true;
}

let agent: ReturnType<typeof createSupportAgent> | undefined;

function getAgent() {
  agent ??= createSupportAgent();
  return agent;
}

export interface AgentRunInput {
  prompt: string;
  /** Caller-owned conversation id. Copied onto run({ context }). Never minted. */
  sessionId?: string;
}

export interface AgentRunResult {
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string };
  correlationId?: string;
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  ensureModelProvider();
  const appContext =
    input.sessionId === undefined ? {} : { sessionId: input.sessionId };
  // Derived once and reused: openaiAgentsContext reads context.sessionId
  // and never mints an id. Never read traceId. Never call getSessionId().
  // Do not call createAgentContext.
  const ctx = openaiAgentsContext({ context: appContext });

  // No guardInbound. Screen before run(). inputGuardrails /
  // outputGuardrails / defineToolInputGuardrail are the SDK's own
  // tripwires, not this policy gate. guard() fails open — check
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

  const result = await run(getAgent(), input.prompt, { context: appContext });

  return {
    message: result.finalOutput ?? "",
    toolResults: collectToolResults(result.newItems),
    correlationId: ctx.correlationId,
  };
}

async function screenInbound(
  text: string,
  ctx: OpenAIAgentsAgentContext,
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

function collectToolResults(items: ReadonlyArray<{ type?: string }>): unknown[] {
  const results: unknown[] = [];
  for (const item of items) {
    if (item.type !== "tool_call_output_item") {
      continue;
    }
    const payload = readToolOutput(item);
    results.push({
      name: readToolName(item),
      arcjetDenied: isArcjetDenial(payload),
      content: payload,
    });
  }
  return results;
}

function readToolOutput(item: unknown): unknown {
  if (!isRecord(item)) {
    return item;
  }
  const raw = "output" in item ? item.output : item;
  if (typeof raw !== "string") {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function readToolName(item: unknown): string {
  if (!isRecord(item)) {
    return "unknown";
  }
  if (typeof item.name === "string" && item.name.length > 0) {
    return item.name;
  }
  const rawItem = isRecord(item.rawItem) ? item.rawItem : undefined;
  if (rawItem !== undefined && typeof rawItem.name === "string") {
    return rawItem.name;
  }
  return "unknown";
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
  return typeof orderId === "string" && orderId.length > 0 ? orderId : undefined;
}

function readLookupInput(input: unknown): { orderId: string; note?: string } {
  const orderId = readOrderId(input) ?? LOOKUP_ORDER_TOOL;
  if (typeof input !== "object" || input === null || !("note" in input)) {
    return { orderId };
  }
  const { note } = input as { note: unknown };
  return typeof note === "string" && note.length > 0 ? { orderId, note } : { orderId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
