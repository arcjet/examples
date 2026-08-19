import { guardTool, openaiAgentsContext } from "@arcjet/guard/openai-agents/v0";
import {
  Agent,
  run,
  setDefaultOpenAIClient,
  setDefaultOpenAIKey,
  tool,
} from "@openai/agents";
import { OpenAI } from "openai";
import { z } from "zod";
import { arcjet, detectInjection, detectPii, lookupLimit } from "./arcjet.ts";

const LOOKUP_ORDER_TOOL = "lookup_order";

const SYSTEM_PROMPT =
  "You are a support agent. Use lookup_order for order questions. " +
  "If a tool call is denied by security policy, do not retry it; explain " +
  "the denial to the user or try a different approach.";

/**
 * needsApproval / result.state.approve is human-in-the-loop, not a policy
 * gate. Same trap as Mastra requireApproval, Claude canUseTool, and
 * LangGraph interrupt(). There is no guardApproval. This pause does not
 * replace guardTool — after resume, invoke still runs through the wrap
 * and Guard is the deny point.
 */
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
    needsApproval: true,
    execute: async ({ orderId, note }) => lookupOrderRecord(orderId, note),
  }),
  {
    action: "order.looked-up",
    // Fail closed: if Arcjet is unreachable execute does not run and
    // the model receives an ArcjetDenialResult with reason ERROR.
    onGuardError: "deny",
    rules: (input: { orderId: string; note?: string }) => {
      const note = input.note;
      return [
        lookupLimit({ key: `order:${input.orderId}`, requested: 1 }),
        // Scan free-text args only. An opaque orderId / call id will not
        // trip EMAIL / phone / card / IP, so do not pass it here.
        ...(typeof note === "string" && note.length > 0 ? [detectPii(note)] : []),
      ];
    },
  },
);

const agent = new Agent({
  name: "support-agent",
  instructions: SYSTEM_PROMPT,
  model: process.env.OPENAI_AGENT_MODEL ?? "gpt-4o-mini",
  tools: [lookupOrder],
});

export interface AgentRunInput {
  prompt: string;
  /** Caller-owned session id. Copied onto run(..., { context }). Never minted. */
  sessionId?: string;
}

export interface AgentRunResult {
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string };
  hitlPauses: unknown[];
  correlationId?: string;
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  configureModel();

  // Preference order inside openaiAgentsContext: context.correlationId →
  // context.sessionId → context.conversationId → context.groupId, then
  // envelope copies. Do not call createAgentContext — that would mint a
  // second id and split the Sequence. Never call session.getSessionId()
  // (MemorySession mints a UUID). Never read traceId. If no valid id is
  // present the call is uncorrelated.
  const appContext =
    input.sessionId === undefined ? {} : { sessionId: input.sessionId };
  const ctx = openaiAgentsContext({ context: appContext });

  // There is no guardInbound. Screen prompt injection in the app before
  // run(). SDK inputGuardrails / outputGuardrails /
  // defineToolInputGuardrail are not Arcjet. Fail closed: a DENY or an
  // unevaluable guard blocks the turn instead of sending untrusted text
  // to the model.
  const inbound = await screenInbound(input.prompt, appContext);
  if (inbound !== undefined) {
    return {
      message: inbound.message,
      toolResults: [],
      inboundBlocked: { reason: inbound.reason },
      hitlPauses: [],
      correlationId: ctx.correlationId,
    };
  }

  let result = await run(agent, input.prompt, { context: appContext });

  // Auto-resume HITL so the one-click demos still finish. The pause is
  // recorded so the page can show that needsApproval is not a deny.
  const hitlPauses: unknown[] = [];
  for (let turn = 0; turn < 8; turn += 1) {
    const paused = result.interruptions;
    if (paused.length === 0) {
      break;
    }
    hitlPauses.push(
      ...paused.map((interruption) => ({
        kind: "human-pause",
        message:
          "Human-in-the-loop pause before tools. This is not a deny. Guard still evaluates in tool invoke.",
        toolName: interruption.name,
      })),
    );
    for (const interruption of paused) {
      result.state.approve(interruption);
    }
    result = await run(agent, result.state);
  }

  return {
    message: readFinalText(result.finalOutput),
    toolResults: collectToolResults(result.newItems),
    hitlPauses,
    correlationId: ctx.correlationId,
  };
}

function configureModel() {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const apiKey = gatewayKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }
  if (gatewayKey) {
    setDefaultOpenAIClient(
      new OpenAI({
        apiKey: gatewayKey,
        baseURL: "https://ai-gateway.vercel.sh/v1",
      }),
    );
    return;
  }
  setDefaultOpenAIKey(apiKey);
}

async function screenInbound(
  text: string,
  appContext: { sessionId?: string },
): Promise<{ reason: string; message: string } | undefined> {
  try {
    const decision = await arcjet.guard({
      label: "message.received",
      rules: [detectInjection(text)],
      ...openaiAgentsContext({ context: appContext }),
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

function readFinalText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  return JSON.stringify(value);
}

function collectToolResults(items: ReadonlyArray<{ type: string }>): unknown[] {
  const results: unknown[] = [];
  for (const item of items) {
    if (!isToolCallOutput(item)) {
      continue;
    }
    const payload = parseToolPayload(item.output ?? item.rawItem.output);
    // The runner stringifies a non-throwing denial onto a
    // function_call_result with status "completed". Do not read
    // status — the denial is arcjetDenied on the payload.
    results.push({
      name: item.rawItem.name,
      status: item.rawItem.status,
      arcjetDenied: isArcjetDenial(payload),
      content: payload,
    });
  }
  return results;
}

function isToolCallOutput(item: {
  type: string;
}): item is {
  type: "tool_call_output_item";
  output: unknown;
  rawItem: { name?: string; status?: string; output?: unknown };
} {
  return item.type === "tool_call_output_item" && "rawItem" in item;
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

function lookupOrderRecord(orderId: string, note?: string) {
  return {
    orderId,
    status: "shipped",
    carrier: "ACME Post",
    eta: "2 days",
    ...(note ? { note } : {}),
  };
}
