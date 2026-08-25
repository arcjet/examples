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

// Authored tool: wrap with guardTool. DENY is a plain ArcjetDenialResult.
// It does not throw and does not fabricate a ToolResultBlock.
// FunctionTool wraps that object in a JsonBlock. Prefer omitting
// outputSchema so the denial can traverse the tool loop.
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
    callback: async ({ orderId, note }) => lookupOrderRecord(orderId, note),
  }),
  {
    action: "order.looked-up",
    // Fail closed: if Arcjet is unreachable the callback does not run
    // and the model receives a structured ERROR denial instead of a throw.
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
  },
);

// Unwrapped / MCP-like tool: gated only via guardHooks
// BeforeToolCallEvent.cancel. Do not also wrap this with guardTool,
// @arcjet/guard/vercel-ai/v7, or @arcjet/guard/langgraph/v1.
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

function chatModel() {
  const id = process.env.STRANDS_MODEL ?? "gpt-4o-mini";
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const apiKey = gatewayKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }
  return new OpenAIModel({
    api: "chat",
    apiKey,
    modelId: id,
    ...(gatewayKey
      ? { clientConfig: { baseURL: "https://ai-gateway.vercel.sh/v1" } }
      : {}),
  });
}

function createSupportAgent(sessionId?: string) {
  return new Agent({
    model: chatModel(),
    tools: [lookupOrder, notifyWarehouse],
    systemPrompt: SYSTEM_PROMPT,
    // interrupt() / event.interrupt() is HITL, not a policy gate. Same
    // trap as Mastra requireApproval, Claude canUseTool, LangGraph
    // interrupt(), OpenAI Agents needsApproval, and LangChain
    // humanInTheLoopMiddleware. There is no guardApproval /
    // guardInterrupt. That pause is not a deny — Guard still evaluates
    // when guardTool / guardHooks run. Do not call interrupt() here.
    plugins: [
      // BeforeToolCallEvent.cancel is the deny for unwrapped / MCP-like
      // tools. Already-branded guardTool tools are skipped so Guard is
      // not double-called. Do not use BeforeToolsEvent.cancel (that
      // skips per-tool hooks).
      guardHooks(arcjet, {
        action: ({ toolName }) => `${toolName}.invoked`,
        onGuardError: "deny",
        sessionId,
        rules: ({ toolName, input }) => {
          if (toolName !== NOTIFY_WAREHOUSE_TOOL) {
            return [];
          }
          const orderId = readOrderId(input) ?? toolName;
          return [warehouseLimit({ key: `order:${orderId}`, requested: 1 })];
        },
      }),
    ],
  });
}

export interface AgentRunInput {
  prompt: string;
  /** Caller-owned id. Copied onto invocationState.sessionId. Never minted. */
  sessionId?: string;
}

export interface AgentRunResult {
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string };
  hookDenials: Array<{ toolName: string; reason: string }>;
  correlationId?: string;
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const invocationState =
    input.sessionId === undefined ? {} : { sessionId: input.sessionId };
  // Derived once and reused: strandsAgentContext reads invocationState
  // and never mints an id. Never read traceId. Never use agent.id or
  // SessionManager. Do not call createAgentContext.
  const ctx = strandsAgentContext({ invocationState });

  // No guardInbound. Screen before agent.invoke() / stream().
  // Middleware / model hooks are not this policy gate. Fail closed.
  const inbound = await screenInbound(input.prompt, ctx);
  if (inbound !== undefined) {
    return {
      message: inbound.message,
      toolResults: [],
      inboundBlocked: { reason: inbound.reason },
      hookDenials: [],
      correlationId: ctx.correlationId,
    };
  }

  const agent = createSupportAgent(input.sessionId);
  const result = await agent.invoke(input.prompt, { invocationState });

  const toolResults = collectToolResults(agent.messages);
  return {
    message: messageText(result.lastMessage),
    toolResults,
    hookDenials: collectHookDenials(toolResults),
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
    // An ALLOW the guard could not actually evaluate. Fail closed rather
    // than sending untrusted text to the model.
    if (decision.hasFailedOpen()) {
      return { reason: "ERROR", message: GUARD_UNAVAILABLE };
    }
    return undefined;
  } catch {
    return { reason: "ERROR", message: GUARD_UNAVAILABLE };
  }
}

function collectToolResults(messages: unknown): unknown[] {
  const names = new Map<string, string>();
  const results: unknown[] = [];
  if (!Array.isArray(messages)) {
    return results;
  }
  for (const message of messages) {
    for (const block of messageBlocks(message)) {
      if (!isRecord(block)) {
        continue;
      }
      if (block.type === "toolUseBlock") {
        const id = typeof block.toolUseId === "string" ? block.toolUseId : "";
        const name = typeof block.name === "string" ? block.name : "";
        if (id.length > 0 && name.length > 0) {
          names.set(id, name);
        }
        continue;
      }
      if (block.type !== "toolResultBlock") {
        continue;
      }
      const payload = readToolResultPayload(block);
      const toolUseId =
        typeof block.toolUseId === "string" ? block.toolUseId : "";
      results.push({
        name: names.get(toolUseId) ?? readToolName(block),
        arcjetDenied: isArcjetDenial(payload),
        content: payload,
      });
    }
  }
  return results;
}

function collectHookDenials(
  toolResults: unknown[],
): Array<{ toolName: string; reason: string }> {
  const denials: Array<{ toolName: string; reason: string }> = [];
  for (const result of toolResults) {
    if (!isRecord(result) || result.arcjetDenied !== true) {
      continue;
    }
    const content = result.content;
    const reason =
      isRecord(content) && typeof content.reason === "string"
        ? content.reason
        : "DENIED";
    denials.push({
      toolName: typeof result.name === "string" ? result.name : "unknown",
      reason,
    });
  }
  return denials;
}

function messageBlocks(message: unknown): unknown[] {
  if (!isRecord(message) || !("content" in message)) {
    return [];
  }
  const { content } = message;
  return Array.isArray(content) ? content : [content];
}

function messageText(message: unknown): string {
  if (typeof message === "string") {
    return message;
  }
  if (!isRecord(message)) {
    return "";
  }
  if (typeof message.content === "string") {
    return message.content;
  }
  const parts: string[] = [];
  for (const block of messageBlocks(message)) {
    if (typeof block === "string") {
      parts.push(block);
      continue;
    }
    if (!isRecord(block)) {
      continue;
    }
    if (typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("");
}

function readToolResultPayload(block: Record<string, unknown>): unknown {
  if ("content" in block) {
    const nested = block.content;
    if (Array.isArray(nested)) {
      for (const item of nested) {
        if (isRecord(item) && "json" in item) {
          return item.json;
        }
        if (isRecord(item) && typeof item.text === "string") {
          return parseJsonish(item.text);
        }
      }
    }
    if (typeof nested === "string") {
      return parseJsonish(nested);
    }
    if (isRecord(nested) && "json" in nested) {
      return nested.json;
    }
  }
  if ("output" in block) {
    return parseJsonish(block.output);
  }
  if ("result" in block) {
    return parseJsonish(block.result);
  }
  return block;
}

function readToolName(block: Record<string, unknown>): string {
  if (typeof block.name === "string" && block.name.length > 0) {
    return block.name;
  }
  if (typeof block.toolName === "string" && block.toolName.length > 0) {
    return block.toolName;
  }
  const toolUseId = block.toolUseId ?? block.tool_use_id;
  return typeof toolUseId === "string" ? toolUseId : "unknown";
}

function parseJsonish(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function lookupOrderRecord(orderId: string, note?: string) {
  return {
    orderId,
    status: "shipped",
    carrier: "ACME Post",
    eta: "2 days",
    ...(note ? { note } : {}),
  };
}
