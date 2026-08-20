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

const SYSTEM_PROMPT =
  "You are a support agent. Use lookup_order for order questions and " +
  "notify_warehouse when the user asks to notify the warehouse. " +
  "lookup_order requires orderNumber and note; if the user did not " +
  "supply a note, pass a short status-check note. " +
  "If a tool call is denied by security policy, do not retry it; explain " +
  "the denial to the user or try a different approach.";

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

// Authored tool: wrap the ToolAction returned by defineTool, not the
// inner handler. generate() looks the live action up by name, so
// guardTool overwrites the original registry key. Prefer omitting
// outputSchema — a denial is ArcjetDenialResult and is not
// schema-checked because the wrapper sits outside action().
const lookupOrder = guardTool(
  arcjet,
  ai.defineTool(
    {
      name: LOOKUP_ORDER_TOOL,
      description:
        "Look up an order by number. Include a note when the user supplies one.",
      inputSchema: z.object({
        orderNumber: z.string(),
        note: z.string(),
      }),
    },
    async ({ orderNumber, note }) => lookupOrderRecord(orderNumber, note),
  ),
  {
    action: "order.looked-up",
    // Fail closed: if Arcjet is unreachable the handler does not run
    // and the model receives an ArcjetDenialResult with reason ERROR.
    onGuardError: "deny",
    rules: (input: { orderNumber: string; note: string }) => [
      lookupLimit({ key: input.orderNumber, requested: 1 }),
      // Scan free-text args only. An opaque orderNumber will not trip
      // EMAIL / phone / card / IP, so do not pass it here.
      detectPii(input.note),
    ],
  },
);

// Unwrapped tool: gated by guardMiddleware, not guardTool. Do not also
// wrap this with guardTool or @arcjet/guard/vercel-ai/v7 — that would
// double-call Guard or throw on a second brand.
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

export interface AgentRunInput {
  prompt: string;
  /** Caller-owned session id. Copied onto generate({ context }). Never minted. */
  sessionId?: string;
}

export interface AgentRunResult {
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string };
  finishReason?: string;
  correlationId?: string;
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }

  // Preference order inside genkitContext: context.correlationId →
  // context.sessionId → context.conversationId → context.flowId /
  // context.runId, then envelope copies. Do not call createAgentContext
  // — that would mint a second id and split the Sequence. Never read
  // Session.sessionId from a Session constructed without an id (that
  // class mints a UUID). Never read traceId. Never treat interrupt /
  // resumed as correlation. If no valid id is present the call is
  // uncorrelated.
  const appContext =
    input.sessionId === undefined ? {} : { sessionId: input.sessionId };
  const ctx = genkitContext({ context: appContext });

  // There is no guardInbound. Middleware `model` is not Guard. Screen
  // prompt injection in the app before generate() / chat.send(). Fail
  // closed: a DENY or an unevaluable guard blocks the turn instead of
  // sending untrusted text to the model.
  const inbound = await screenInbound(input.prompt, appContext);
  if (inbound !== undefined) {
    return {
      message: inbound.message,
      toolResults: [],
      inboundBlocked: { reason: inbound.reason },
      correlationId: ctx.correlationId,
    };
  }

  // Put the same caller-owned id on guardMiddleware({ sessionId }) AND
  // generate({ context: { sessionId } }). Tool-hook ctx from
  // toRunOptions is only { metadata, resumed } — no ALS context — so
  // policy.sessionId is what correlates the middleware decision.
  const result = await ai.generate({
    system: SYSTEM_PROMPT,
    prompt: input.prompt,
    tools: [lookupOrder, notifyWarehouse],
    use: [
      guardMiddleware(arcjet, {
        action: ({ toolName }) => `${toolName}.invoked`,
        onGuardError: "deny",
        sessionId: input.sessionId,
        rules: ({ toolName, input: toolInput }) => {
          // lookup_order is already branded by guardTool. Middleware
          // skips that brand when it can look the action up — this
          // branch is belt and braces if a future tool is added
          // unwrapped.
          if (toolName !== NOTIFY_WAREHOUSE_TOOL) {
            return [];
          }
          const orderNumber = readOrderNumber(toolInput) ?? toolName;
          // First notify is denied: requested > maxTokens. Middleware
          // is the deny point (completed toolResponse, not interrupt).
          return [warehouseLimit({ key: `order:${orderNumber}`, requested: 100 })];
        },
      }),
    ],
    context: appContext,
    maxTurns: 8,
  });

  return {
    message: result.text,
    toolResults: collectToolResults(result.messages),
    finishReason: result.finishReason,
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
    // guard() fails open — an ALLOW is not proof the rules ran.
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
    if (message.role !== "tool") {
      continue;
    }
    const content = message.content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (typeof part !== "object" || part === null || !("toolResponse" in part)) {
        continue;
      }
      const toolResponse = (part as { toolResponse?: { name?: string; output?: unknown } })
        .toolResponse;
      if (toolResponse === undefined) {
        continue;
      }
      const output = toolResponse.output;
      // DENY is a completed toolResponse.output with arcjetDenied: true.
      // Do not read finishReason / interrupts — those are HITL.
      results.push({
        name: toolResponse.name,
        arcjetDenied: isArcjetDenial(output),
        content: output,
      });
    }
  }
  return results;
}

function isArcjetDenial(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "arcjetDenied" in value &&
    value.arcjetDenied === true
  );
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

function lookupOrderRecord(orderNumber: string, note: string) {
  return {
    orderNumber,
    status: "shipped",
    carrier: "ACME Post",
    eta: "2 days",
    note,
  };
}
