import {
  guardMiddleware,
  guardTool,
  langchainContext,
} from "@arcjet/guard/langchain/v1";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
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

const LOOKUP_ORDER_TOOL = "lookup_order";
const NOTIFY_WAREHOUSE_TOOL = "notify_warehouse";

const SYSTEM_PROMPT =
  "You are a support agent. Use lookup_order for order questions and " +
  "notify_warehouse when the user asks to notify the warehouse. " +
  "If a tool call is denied by security policy, do not retry it; explain " +
  "the denial to the user or try a different approach.";

// Authored tool: wrap with guardTool. DENY is a plain ArcjetDenialResult
// with arcjetDenied: true — the helper does not throw and does not
// fabricate a ToolMessage. createAgent's ToolNode baseHandler wraps a
// non-ToolMessage in a real ToolMessage whose status is "success"
// (the tool did not throw). The denial is in the payload, not the
// envelope. Distinct from guardMiddleware, which MUST return a real
// ToolMessage from wrapToolCall (a bare object is the reducer-crash
// case).
const lookupOrderTool = tool(
  async ({ orderId, note }: { orderId: string; note?: string }) =>
    lookupOrderRecord(orderId, note),
  {
    name: LOOKUP_ORDER_TOOL,
    description:
      "Look up an order by ID. Include a note when the user supplies one.",
    schema: z.object({
      orderId: z.string(),
      note: z.string().optional(),
    }),
  },
);

const lookupOrder = guardTool(arcjet, lookupOrderTool, {
  action: "order.looked-up",
  // Fail closed: if Arcjet is unreachable the handler does not run and
  // the model receives an ArcjetDenialResult with reason ERROR.
  onGuardError: "deny",
  rules: (input) => {
    const orderId = readOrderId(input) ?? "unknown";
    const note = readNote(input);
    return [
      lookupLimit({ key: `order:${orderId}`, requested: 1 }),
      // Scan free-text args only. An opaque orderId will not trip EMAIL /
      // phone / card / IP, so do not pass it here.
      ...(note !== undefined ? [detectPii(note)] : []),
    ];
  },
});

// Unwrapped tool: gated by guardMiddleware wrapToolCall, not guardTool.
// Do not also wrap this with guardTool or @arcjet/guard/langgraph/v1 or
// @arcjet/guard/vercel-ai/v7 — that would double-call Guard or throw on
// a second brand. MCP-like / runtime-discovered tools take this path.
const notifyWarehouse = tool(
  async ({ orderId }: { orderId: string }) => ({
    orderId,
    notified: true,
    destination: "warehouse",
  }),
  {
    name: NOTIFY_WAREHOUSE_TOOL,
    description: "Notify the warehouse that an order is ready to pick.",
    schema: z.object({
      orderId: z.string(),
    }),
  },
);

const tools = [lookupOrder, notifyWarehouse];

// humanInTheLoopMiddleware / interrupt() is HITL, not a policy gate.
// Same trap as Mastra requireApproval, Claude canUseTool, and LangGraph
// interrupt(). There is no guardApproval. Do not deny in afterModel —
// HITL already lives there. Policy sits on wrapToolCall only. This
// example does not install HITL; the unused comment is the demo that
// wrapToolCall (not interrupt) is the deny point for unwrapped tools.
//
// import { humanInTheLoopMiddleware } from "langchain";
// const hitlDemo = humanInTheLoopMiddleware({ interruptOn: {} });

let agent: ReturnType<typeof createAgent> | undefined;

function getAgent() {
  agent ??= createAgent({
    model: model(),
    tools,
    systemPrompt: SYSTEM_PROMPT,
    middleware: [
      // wrapToolCall is the invoke()-wide gate for MCP / unwrapped tools.
      // On DENY it returns a real ToolMessage (content = JSON of the
      // payload) without calling handler. Do not set status: "error".
      // Do not throw — throws bubble and drop arcjetDenied.
      guardMiddleware(arcjet, {
        action: ({ toolName }) => `${toolName}.invoked`,
        onGuardError: "deny",
        rules: ({ toolName, input }) => {
          // lookup_order is already branded by guardTool. guardMiddleware
          // skips that brand so Guard is not double-called — this branch
          // is belt and braces if a future tool is added unwrapped.
          if (toolName !== NOTIFY_WAREHOUSE_TOOL) {
            return [];
          }
          const orderId = readOrderId(input) ?? toolName;
          return [warehouseLimit({ key: `order:${orderId}`, requested: 1 })];
        },
      }),
    ],
  });
  return agent;
}

function model() {
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
  // Preference order inside langchainContext: configurable.thread_id →
  // caller-owned sessionId / conversationId. Do not call
  // createAgentContext — that would mint a second id and split the
  // Sequence. If no valid id is present the call is uncorrelated.
  const config =
    input.threadId === undefined
      ? {}
      : { configurable: { thread_id: input.threadId } };
  const ctx = langchainContext(config);

  // There is no guardInbound. Screen prompt injection in the app
  // before agent.invoke. wrapModelCall / beforeModel / afterModel
  // intercept the model call, not user text — they are not this
  // policy gate. Fail closed: a DENY or an unevaluable guard blocks
  // the turn instead of sending untrusted text to the model.
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
    message: readLastAiText(result.messages),
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
    if (decision.conclusion === "DENY") {
      return {
        reason: decision.reason,
        message: `Arcjet denied this call (${decision.reason}). Do not retry; explain the denial to the user or try a different approach.`,
      };
    }
    if (decision.hasFailedOpen()) {
      return {
        reason: "ERROR",
        message:
          "Arcjet security check could not be completed; please retry later.",
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

function lastAiMessage(messages: BaseMessage[]): AIMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && message.getType() === "ai") {
      return message as AIMessage;
    }
  }
  return undefined;
}

function readLastAiText(messages: BaseMessage[]): string {
  const last = lastAiMessage(messages);
  if (last === undefined) {
    return "";
  }
  return typeof last.content === "string"
    ? last.content
    : JSON.stringify(last.content);
}

function collectToolResults(messages: BaseMessage[]): unknown[] {
  const results: unknown[] = [];
  for (const message of messages) {
    if (message.getType() !== "tool") {
      continue;
    }
    const payload = parseToolPayload(message.content);
    // createAgent's baseHandler wraps a non-throwing guardTool denial
    // as ToolMessage status "success". guardMiddleware wrapToolCall
    // also leaves status as success — it returns a real ToolMessage
    // whose content is the JSON payload. Do not read message.status
    // and do not set status: "error". The denial is arcjetDenied on
    // the payload.
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

function readOrderId(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("orderId" in input)) {
    return undefined;
  }
  const { orderId } = input as { orderId: unknown };
  return typeof orderId === "string" && orderId.length > 0 ? orderId : undefined;
}

function readNote(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("note" in input)) {
    return undefined;
  }
  const { note } = input as { note: unknown };
  return typeof note === "string" && note.length > 0 ? note : undefined;
}

function lookupOrderRecord(orderId: string, note?: string) {
  return {
    orderId,
    status: "shipped",
    carrier: "ACME Post",
    eta: "2 days",
    ...(note ? { note } : {}),
  };
}
