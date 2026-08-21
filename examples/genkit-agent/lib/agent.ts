import { guardMiddleware, guardTool, genkitContext } from "@arcjet/guard/genkit/v1";
import { openAICompatible } from "@genkit-ai/compat-oai";
import { genkit, z } from "genkit";
import {
  arcjet,
  detectInjection,
  detectPii,
  lookupLimit,
  warehouseLimit,
} from "./arcjet.ts";

const LOOKUP_ORDER_TOOL = "lookup_order";
const NOTIFY_WAREHOUSE_TOOL = "notify_warehouse";

const ai = genkit({
  plugins: [
    openAICompatible({
      name: "gateway",
      apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
      baseURL: "https://ai-gateway.vercel.sh/v1",
    }),
  ],
  model: `gateway/${process.env.GENKIT_MODEL ?? "gpt-4o-mini"}`,
});

// Authored tool: wrap with guardTool. DENY is a structured result — do not
// throw. Omit outputSchema so the denial object can traverse the tool loop.
const lookupOrder = guardTool(
  arcjet,
  ai.defineTool(
    {
      name: LOOKUP_ORDER_TOOL,
      description:
        "Look up an order by number. Include a note when the user supplies one.",
      inputSchema: z.object({
        orderNumber: z.string(),
        note: z.string().optional(),
      }),
    },
    async ({ orderNumber, note }) => ({
      orderNumber,
      status: "shipped",
      carrier: "ACME Post",
      eta: "2 days",
      ...(note ? { note } : {}),
    }),
  ),
  {
    action: "order.looked-up",
    onGuardError: "deny",
    rules: (input: { orderNumber: string; note?: string }) => [
      lookupLimit({ key: `order:${input.orderNumber}`, requested: 1 }),
      // Scan free-text args only. An opaque orderNumber will not trip EMAIL /
      // phone / card / IP, so do not pass it here.
      ...(typeof input.note === "string" && input.note.length > 0
        ? [detectPii(input.note)]
        : []),
    ],
  },
);

// Unwrapped tool: gated by guardMiddleware, not guardTool. Do not also wrap
// this with @arcjet/guard/vercel-ai/v7.
const notifyWarehouse = ai.defineTool(
  {
    name: NOTIFY_WAREHOUSE_TOOL,
    description: "Notify the warehouse that an order is ready to pick.",
    inputSchema: z.object({
      orderNumber: z.string(),
    }),
  },
  async ({ orderNumber }) => ({
    orderNumber,
    notified: true,
    destination: "warehouse",
  }),
);

export async function runAgent(input: {
  prompt: string;
  sessionId?: string;
}): Promise<{
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string };
  correlationId?: string;
}> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }

  const appContext =
    input.sessionId === undefined ? {} : { sessionId: input.sessionId };
  const ctx = genkitContext({ context: appContext });

  // There is no guardInbound. Screen prompt injection before generate().
  // Fail closed: DENY or hasFailedOpen() skips the model.
  const inbound = await screenInbound(input.prompt, appContext);
  if (inbound !== undefined) {
    return {
      message: inbound.message,
      toolResults: [],
      inboundBlocked: { reason: inbound.reason },
      correlationId: ctx.correlationId,
    };
  }

  const result = await ai.generate({
    system:
      "You are a support agent. Use lookup_order for order questions and " +
      "notify_warehouse when the user asks to notify the warehouse. " +
      "If a tool call is denied by security policy, do not retry it; explain " +
      "the denial to the user or try a different approach.",
    prompt: input.prompt,
    tools: [lookupOrder, notifyWarehouse],
    use: [
      guardMiddleware(arcjet, {
        action: ({ toolName }) => `${toolName}.invoked`,
        onGuardError: "deny",
        sessionId: input.sessionId,
        rules: ({ toolName, input: toolInput }) => {
          if (toolName !== NOTIFY_WAREHOUSE_TOOL) {
            return [];
          }
          const orderNumber = readOrderNumber(toolInput) ?? toolName;
          return [warehouseLimit({ key: `order:${orderNumber}`, requested: 1 })];
        },
      }),
    ],
    context: appContext,
  });

  return {
    message: result.text,
    toolResults: collectToolResults(result.messages),
    correlationId: ctx.correlationId,
  };
}

async function screenInbound(
  text: string,
  appContext: { sessionId?: string },
): Promise<{ reason: string; message: string } | undefined> {
  try {
    const decision = await arcjet.guard({
      label: "message.received",
      rules: [detectInjection(text)],
      ...genkitContext({ context: appContext }),
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

function collectToolResults(
  messages: ReadonlyArray<{ role?: string; content?: unknown }>,
): unknown[] {
  const results: unknown[] = [];
  for (const message of messages) {
    if (message.role !== "tool" || !Array.isArray(message.content)) {
      continue;
    }
    for (const part of message.content) {
      if (typeof part === "object" && part !== null && "toolResponse" in part) {
        results.push((part as { toolResponse: unknown }).toolResponse);
      }
    }
  }
  return results;
}

function readOrderNumber(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("orderNumber" in input)) {
    return undefined;
  }
  const { orderNumber } = input as { orderNumber: unknown };
  return typeof orderNumber === "string" && orderNumber.length > 0
    ? orderNumber
    : undefined;
}
