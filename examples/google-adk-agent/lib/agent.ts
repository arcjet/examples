import {
  googleAdkContext,
  guardPlugin,
  type GoogleAdkAgentContext,
} from "@arcjet/guard/google-adk/v2";
import {
  FunctionTool,
  InMemorySessionService,
  LlmAgent,
  Runner,
} from "@google/adk";
import { z } from "zod";
import {
  arcjet,
  detectInjection,
  detectPii,
  lookupLimit,
} from "./arcjet.ts";

const APP_NAME = "google-adk-agent-example";
const USER_ID = "demo-user";
const LOOKUP_ORDER_TOOL = "lookup_order";

const GUARD_UNAVAILABLE =
  "Arcjet security check could not be completed; please retry later.";

const SYSTEM_PROMPT =
  "You are a support agent. Use lookup_order for order questions. " +
  "If a tool call is denied by security policy, do not retry it; explain " +
  "the denial to the user or try a different approach.";

// One FunctionTool with a local execute so BasePlugin.beforeToolCallback
// actually runs. There is no guardTool — skip is the plugin return, not
// throw-from-execute. requireConfirmation on FunctionTool is HITL, not
// policy — do not set it as the deny. Do not wrap this with
// @arcjet/guard/vercel-ai/v7.
const lookupOrder = new FunctionTool({
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
});

export interface AgentRunInput {
  prompt: string;
  /**
   * Caller-owned conversation / session id. Copied onto helper options
   * and `googleAdkContext({ context: { sessionId } })`. Never minted.
   * Never `invocationId`. Never `traceId`. Never session auto-ids.
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
  const geminiKey = process.env.GOOGLE_GENAI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error("GOOGLE_GENAI_API_KEY is required");
  }

  const appContext =
    input.sessionId === undefined ? {} : { sessionId: input.sessionId };
  // Derived once and reused: googleAdkContext reads helper options /
  // context and never mints an id. Never read invocationId, traceId,
  // functionCallId, or toolContext.sessionId / session.id. Do not call
  // createAgentContext.
  const ctx = googleAdkContext({ context: appContext });

  // No guardInbound. Screen before Runner.runAsync. onUserMessageCallback
  // / beforeModelCallback replace the user message or return Content /
  // LlmResponse; they are not this policy gate. guard() fails open —
  // check hasFailedOpen().
  const inbound = await screenInbound(input.prompt, ctx);
  if (inbound !== undefined) {
    return {
      message: inbound.message,
      toolResults: [],
      inboundBlocked: { reason: inbound.reason },
      correlationId: ctx.correlationId,
    };
  }

  const sessionService = new InMemorySessionService();
  // ADK requires a session id for Runner.runAsync. When the caller did
  // not provide one, this local id is for ADK bookkeeping only — it is
  // never passed to googleAdkContext or guardPlugin.
  const adkSessionId = input.sessionId ?? "uncorrelated";
  await sessionService.createSession({
    appName: APP_NAME,
    userId: USER_ID,
    sessionId: adkSessionId,
  });

  const agent = new LlmAgent({
    name: "support_agent",
    description: "A support agent that looks up orders.",
    model: process.env.GOOGLE_ADK_MODEL ?? "gemini-2.0-flash",
    instruction: SYSTEM_PROMPT,
    tools: [lookupOrder],
  });

  const runner = new Runner({
    appName: APP_NAME,
    agent,
    sessionService,
    // requireConfirmation / requestConfirmation / SecurityPlugin CONFIRM
    // is HITL, not a policy gate. Same trap as Mastra requireApproval,
    // Claude canUseTool, LangGraph interrupt(), Genkit toolApproval,
    // OpenAI Agents needsApproval, LangChain humanInTheLoopMiddleware,
    // and TanStack needsApproval. There is no guardApproval. That pause
    // is not a deny — Guard still evaluates when beforeToolCallback
    // runs. Do not install those hooks as the policy gate. Do not use
    // ADK SecurityPlugin as the Arcjet policy gate.
    plugins: [
      // Put Arcjet first. PluginManager is first-win; if another plugin
      // (including SecurityPlugin) returns a value first, Guard never
      // runs. Default DENY is an ArcjetDenialResult dict so ADK skips
      // runAsync and the model sees the payload. The callback does not
      // throw — PluginManager treats a throw as a plugin error, not
      // skip. On Guard error this helper fail-closes: it ALWAYS returns
      // a deny dict, never undefined.
      guardPlugin(arcjet, {
        action: ({ toolName }) => `${toolName}.invoked`,
        sessionId: input.sessionId,
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
    ],
  });

  const events: unknown[] = [];
  for await (const event of runner.runAsync({
    userId: USER_ID,
    sessionId: adkSessionId,
    newMessage: { role: "user", parts: [{ text: input.prompt }] },
  })) {
    events.push(event);
  }

  return {
    message: collectMessageText(events),
    toolResults: collectToolResults(events),
    correlationId: ctx.correlationId,
  };
}

async function screenInbound(
  text: string,
  ctx: GoogleAdkAgentContext,
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
  } catch {
    return { reason: "ERROR", message: GUARD_UNAVAILABLE };
  }
}

function collectMessageText(events: unknown[]): string {
  const parts: string[] = [];
  for (const event of events) {
    for (const block of eventParts(event)) {
      if (typeof block.text === "string" && block.text.length > 0) {
        parts.push(block.text);
      }
    }
  }
  return parts.join("");
}

function collectToolResults(events: unknown[]): unknown[] {
  const names = new Map<string, string>();
  const results: unknown[] = [];
  for (const event of events) {
    for (const block of eventParts(event)) {
      const functionCall = asRecord(block.functionCall);
      if (functionCall !== undefined) {
        const id = typeof functionCall.id === "string" ? functionCall.id : "";
        const name = typeof functionCall.name === "string" ? functionCall.name : "";
        if (id.length > 0 && name.length > 0) {
          names.set(id, name);
        }
        continue;
      }
      const functionResponse = asRecord(block.functionResponse);
      if (functionResponse === undefined) {
        continue;
      }
      const payload = functionResponse.response ?? functionResponse;
      const id =
        typeof functionResponse.id === "string" ? functionResponse.id : "";
      const name =
        typeof functionResponse.name === "string"
          ? functionResponse.name
          : (names.get(id) ?? "unknown");
      results.push({
        name,
        arcjetDenied: isArcjetDenial(payload),
        content: payload,
      });
    }
  }
  return results;
}

function eventParts(event: unknown): Array<Record<string, unknown>> {
  if (!isRecord(event)) {
    return [];
  }
  const content = asRecord(event.content);
  if (content === undefined || !Array.isArray(content.parts)) {
    return [];
  }
  return content.parts.filter(isRecord);
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
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
