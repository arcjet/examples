import {
  guardMiddleware,
  guardTool,
  langchainContext,
} from "@arcjet/guard/langchain/v1";
import { type BaseMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { z } from "zod";
import {
  arcjet,
  detectInjection,
  detectPii,
  lookupLimit,
  warehouseLimit,
} from "./arcjet.ts";

const LOOKUP_ORDER = "lookup_order";
const NOTIFY_WAREHOUSE = "notify_warehouse";

// guardTool DENY is a plain ArcjetDenialResult. It does not throw and does
// not fabricate a ToolMessage. createAgent's baseHandler wraps that object
// in a success ToolMessage. Distinct from guardMiddleware, which MUST
// return a real ToolMessage from wrapToolCall (a bare object crashes the
// reducer). Do not set status: "error".
const lookupOrder = guardTool(
  arcjet,
  tool(
    async ({ orderId, note }: { orderId: string; note?: string }) => ({
      orderId,
      status: "shipped",
      carrier: "ACME Post",
      eta: "2 days",
      ...(note ? { note } : {}),
    }),
    {
      name: LOOKUP_ORDER,
      description:
        "Look up an order by ID. Include a note when the user supplies one.",
      schema: z.object({
        orderId: z.string(),
        note: z.string().optional(),
      }),
    },
  ),
  {
    action: "order.looked-up",
    onGuardError: "deny",
    rules: ({ orderId, note }) => [
      lookupLimit({ key: `order:${orderId}`, requested: 1 }),
      // Scan free-text args only. An opaque orderId will not trip EMAIL /
      // phone / card / IP.
      ...(note ? [detectPii(note)] : []),
    ],
  },
);

// Unwrapped / MCP-like tool: gated only via guardMiddleware wrapToolCall.
const notifyWarehouse = tool(
  async ({ orderId }: { orderId: string }) => ({
    orderId,
    notified: true,
    destination: "warehouse",
  }),
  {
    name: NOTIFY_WAREHOUSE,
    description: "Notify the warehouse that an order is ready to pick.",
    schema: z.object({ orderId: z.string() }),
  },
);

const tools = [lookupOrder, notifyWarehouse];

// humanInTheLoopMiddleware / interrupt() is HITL, not a policy gate.
// Do not deny in afterModel. wrapToolCall is the deny point for unwrapped tools.

type AgentModel = NonNullable<Parameters<typeof createAgent>[0]["model"]>;

function createSupportAgent(model: AgentModel) {
  return createAgent({
    model,
    tools,
    systemPrompt:
      "You are a support agent. Use lookup_order for order questions and " +
      "notify_warehouse when the user asks to notify the warehouse. " +
      "If a tool call is denied by security policy, do not retry it; explain " +
      "the denial to the user or try a different approach.",
    middleware: [
      // wrapToolCall DENY returns a real ToolMessage without calling handler.
      // Already-branded guardTool tools are skipped so Guard is not double-called.
      guardMiddleware(arcjet, {
        action: ({ toolName }) => `${toolName}.invoked`,
        onGuardError: "deny",
        rules: ({ toolName, input }) => {
          if (toolName !== NOTIFY_WAREHOUSE) {
            return [];
          }
          const orderId = readStringField(input, "orderId") ?? toolName;
          return [warehouseLimit({ key: `order:${orderId}`, requested: 1 })];
        },
      }),
    ],
  });
}

function chatModel() {
  const id = process.env.LANGCHAIN_MODEL ?? "gpt-4o-mini";
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const apiKey = gatewayKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }
  return new ChatOpenAI({
    model: id,
    apiKey,
    ...(gatewayKey
      ? { configuration: { baseURL: "https://ai-gateway.vercel.sh/v1" } }
      : {}),
  });
}

let defaultAgent: ReturnType<typeof createSupportAgent> | undefined;

function getAgent() {
  defaultAgent ??= createSupportAgent(chatModel());
  return defaultAgent;
}

export interface AgentRunInput {
  prompt: string;
  /** Caller-owned conversation id. Copied onto configurable.thread_id. Never minted. */
  threadId?: string;
}

export interface AgentRunResult {
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string };
  correlationId?: string;
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const config =
    input.threadId === undefined
      ? {}
      : { configurable: { thread_id: input.threadId } };
  const ctx = langchainContext(config);

  // No guardInbound. Screen before agent.invoke. wrapModelCall /
  // beforeModel / afterModel are not this gate. Fail closed.
  const inbound = await screenInbound(input.prompt, config);
  if (inbound !== undefined) {
    return {
      message: inbound.message,
      toolResults: [],
      inboundBlocked: { reason: inbound.reason },
      correlationId: ctx.correlationId,
    };
  }

  const result = await getAgent().invoke(
    { messages: [{ role: "user", content: input.prompt }] },
    config,
  );

  return {
    message: lastAiText(result.messages),
    toolResults: collectToolResults(result.messages),
    correlationId: ctx.correlationId,
  };
}

async function screenInbound(
  text: string,
  config: { configurable?: { thread_id?: string } },
): Promise<{ reason: string; message: string } | undefined> {
  try {
    const decision = await arcjet.guard({
      label: "message.received",
      rules: [detectInjection(text)],
      ...langchainContext(config),
    });
    if (decision.conclusion === "DENY" || decision.hasFailedOpen()) {
      return {
        reason: decision.conclusion === "DENY" ? decision.reason : "ERROR",
        message:
          decision.conclusion === "DENY"
            ? `Arcjet denied this call (${decision.reason}). Do not retry; explain the denial to the user or try a different approach.`
            : "Arcjet security check could not be completed; please retry later.",
      };
    }
    return undefined;
  } catch {
    return {
      reason: "ERROR",
      message:
        "Arcjet security check could not be completed; please retry later.",
    };
  }
}

function lastAiText(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.getType() === "ai") {
      return typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);
    }
  }
  return "";
}

function collectToolResults(messages: BaseMessage[]): unknown[] {
  const results: unknown[] = [];
  for (const message of messages) {
    if (message.getType() !== "tool") {
      continue;
    }
    const payload = parseToolPayload(message.content);
    results.push({
      name: message.name,
      arcjetDenied: isArcjetDenial(payload),
      content: payload,
    });
  }
  return results;
}

function parseToolPayload(content: unknown): unknown {
  if (typeof content !== "string") {
    return content;
  }
  try {
    return JSON.parse(content);
  } catch {
    return content;
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

function readStringField(input: unknown, key: string): string | undefined {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
