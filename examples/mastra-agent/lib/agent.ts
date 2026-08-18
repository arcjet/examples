import {
  guardHooks,
  guardProcessor,
  guardTool,
} from "@arcjet/guard/mastra/v1";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import type {
  ToolAfterHookContext,
  ToolHookContext,
} from "@mastra/core/tools";
import { z } from "zod";
import {
  arcjet,
  detectInjection,
  detectPii,
  lookupLimit,
  warehouseLimit,
} from "./arcjet.ts";

const LOOKUP_ORDER_TOOL = "lookup-order";
const NOTIFY_WAREHOUSE_TOOL = "notify-warehouse";

// Authored tool: wrap with guardTool. DENY is a structured result — do not
// throw. Omit outputSchema so the denial object can traverse the tool loop.
const lookupOrder = guardTool(
  arcjet,
  createTool({
    id: LOOKUP_ORDER_TOOL,
    description: "Look up an order by ID. Include a note when the user supplies one.",
    inputSchema: z.object({
      orderId: z.string(),
      note: z.string().optional(),
    }),
    async execute({ orderId, note }) {
      return lookupOrderRecord(orderId, note);
    },
  }),
  {
    action: "order.looked-up",
    // Fail closed: if Arcjet is unreachable the tool does not run and the
    // model receives a structured ERROR denial instead of a throw.
    onGuardError: "deny",
    rules: ({ orderId, note }) => [
      lookupLimit({ key: `order:${orderId}`, requested: 1 }),
      // Scan free-text args only. An opaque orderId will not trip EMAIL /
      // phone / card / IP, so do not pass it here.
      ...(typeof note === "string" && note.length > 0 ? [detectPii(note)] : []),
    ],
  },
);

// Unwrapped tool: gated by guardHooks, not guardTool. Do not also wrap this
// with @arcjet/guard/vercel-ai/v7 — Mastra tools are createTool, not AI SDK
// tool(), and double-wrapping throws.
const notifyWarehouse = createTool({
  id: NOTIFY_WAREHOUSE_TOOL,
  description: "Notify the warehouse that an order is ready to pick.",
  inputSchema: z.object({
    orderId: z.string(),
  }),
  async execute({ orderId }) {
    return { orderId, notified: true, destination: "warehouse" };
  },
});

const inbound = guardProcessor(arcjet, {
  action: "message.received",
  // Fail closed: an unreachable guard aborts the turn (Mastra tripwire)
  // rather than sending untrusted text to the model.
  onGuardError: "deny",
  rules: ({ text }) => [detectInjection(text)],
});

const unwrappedHooks = guardHooks(arcjet, {
  action: ({ toolName }) => `${toolName}.invoked`,
  onGuardError: "deny",
  rules: ({ toolName, input }) => {
    if (toolName !== NOTIFY_WAREHOUSE_TOOL) {
      return [];
    }
    const orderId = readOrderId(input) ?? toolName;
    return [warehouseLimit({ key: `order:${orderId}`, requested: 1 })];
  },
});

// guardHooks is for tools this package did not wrap. Skip lookup-order so
// the same authored tool is not double-gated.
const hooks = {
  async beforeToolCall(context: ToolHookContext) {
    if (context.toolName === LOOKUP_ORDER_TOOL) {
      return;
    }
    return unwrappedHooks.beforeToolCall?.(context);
  },
  afterToolCall(context: ToolAfterHookContext) {
    if (context.toolName === LOOKUP_ORDER_TOOL) {
      return;
    }
    return unwrappedHooks.afterToolCall?.(context);
  },
};

export const agent = new Agent({
  id: "support-agent",
  name: "support-agent",
  instructions:
    "You are a support agent. Use lookup-order for order questions and " +
    "notify-warehouse when the user asks to notify the warehouse. " +
    "If a tool call is denied by security policy, do not retry it; explain " +
    "the denial to the user or try a different approach.",
  model: modelConfig(),
  tools: { lookupOrder, notifyWarehouse },
  inputProcessors: [inbound],
  hooks,
});

function modelConfig() {
  const id = process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini";
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    return {
      id,
      apiKey: gatewayKey,
      url: "https://ai-gateway.vercel.sh/v1",
    };
  }
  return id;
}

function readOrderId(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("orderId" in input)) {
    return undefined;
  }
  const { orderId } = input as { orderId: unknown };
  return typeof orderId === "string" && orderId.length > 0 ? orderId : undefined;
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
