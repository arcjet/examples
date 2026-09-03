import {
  guardMiddleware,
  tanstackAiContext,
  type TanStackAiAgentContext,
} from "@arcjet/guard/tanstack-ai/v0";
import { chat, streamToText, toolDefinition } from "@tanstack/ai";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";
import { z } from "zod";
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

// One server tool with a local execute so ChatMiddleware.onBeforeToolCall
// actually runs. Client tools and provider-native tools (no local execute)
// are out of scope. There is no guardTool — a throw from execute is
// swallowed into { error } and is not a usable deny envelope. Omit
// outputSchema so a skip-deny ArcjetDenialResult can traverse the loop.
const lookupOrder = toolDefinition({
  name: LOOKUP_ORDER_TOOL,
  description:
    "Look up an order by ID. Include a note when the user supplies one.",
  inputSchema: z.object({
    orderId: z.string(),
    note: z.string().optional(),
  }),
}).server(async ({ orderId, note }) => ({
  orderId,
  status: "shipped",
  carrier: "ACME Post",
  eta: "2 days",
  ...(note ? { note } : {}),
}));

function chatAdapter() {
  const id = process.env.TANSTACK_MODEL ?? "gpt-4o-mini";
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const apiKey = gatewayKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY or OPENAI_API_KEY is required");
  }
  return openaiCompatibleText(id, {
    name: gatewayKey ? "vercel-ai-gateway" : "openai",
    apiKey,
    api: "chat-completions",
    baseURL: gatewayKey
      ? "https://ai-gateway.vercel.sh/v1"
      : "https://api.openai.com/v1",
  });
}

export interface AgentRunInput {
  prompt: string;
  /**
   * Caller-owned conversation / session id. Copied onto
   * `chat({ context: { sessionId } })`. Never minted. Never
   * `ctx.threadId` (TanStack auto-generates it).
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
  const appContext =
    input.sessionId === undefined ? {} : { sessionId: input.sessionId };
  // Derived once and reused: tanstackAiContext reads helper options /
  // chat({ context }) and never mints an id. Never read threadId,
  // traceId, requestId, or streamId. Do not call createAgentContext.
  const ctx = tanstackAiContext({ context: appContext });

  // No guardInbound. Screen before chat(). contentGuardMiddleware
  // redacts the stream; it is not this policy gate. guard() fails open
  // — check hasFailedOpen().
  const inbound = await screenInbound(input.prompt, ctx);
  if (inbound !== undefined) {
    return {
      message: inbound.message,
      toolResults: [],
      inboundBlocked: { reason: inbound.reason },
      correlationId: ctx.correlationId,
    };
  }

  const toolResults: unknown[] = [];
  const stream = chat({
    adapter: chatAdapter(),
    messages: [{ role: "user", content: input.prompt }],
    systemPrompts: [SYSTEM_PROMPT],
    tools: [lookupOrder],
    context: appContext,
    // needsApproval / defineInterrupt / onInterruptBoundary is HITL,
    // not a policy gate. Same trap as Mastra requireApproval, Claude
    // canUseTool, LangGraph interrupt(), Genkit toolApproval, OpenAI
    // Agents needsApproval, and LangChain humanInTheLoopMiddleware.
    // There is no guardApproval. That pause is not a deny — Guard
    // still evaluates when onBeforeToolCall runs. Do not install
    // those hooks as the policy gate.
    middleware: [
      // Put Arcjet first. onBeforeToolCall is first-win; if
      // toolCacheMiddleware (or anything else) skips first, Guard
      // never runs. Default DENY is { type: "skip", result:
      // ArcjetDenialResult } so the tool never runs and the model
      // sees the payload. Optional onDeny: "abort" returns
      // { type: "abort", reason } and stops the run — shown here as
      // a comment, not the default. The hook does not throw.
      //
      //   guardMiddleware(arcjet, { onDeny: "abort", ... })
      //
      // onDeny: "abort" applies to real DENY only; unavailable stays skip.
      //
      // Do not also wrap with @arcjet/guard/vercel-ai/v7. Do not
      // name anything contentGuardMiddleware (TanStack already has
      // that name).
      guardMiddleware(arcjet, {
        action: ({ toolName }) => `${toolName}.invoked`,
        sessionId: input.sessionId,
        // Default is already deny; set it explicitly so tool-call
        // outages fail closed via skip-deny.
        onGuardError: "deny",
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
      }),
      {
        name: "collect-tool-results",
        onAfterToolCall(_ctx, info) {
          toolResults.push({
            name: info.toolName,
            arcjetDenied: isArcjetDenial(info.result),
            content: info.result,
          });
        },
      },
    ],
  });

  return {
    // streamToText throws on RUN_ERROR instead of returning an empty 200.
    message: await streamToText(stream),
    toolResults,
    correlationId: ctx.correlationId,
  };
}

async function screenInbound(
  text: string,
  ctx: TanStackAiAgentContext,
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
