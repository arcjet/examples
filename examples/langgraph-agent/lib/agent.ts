import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import {
  Command,
  END,
  interrupt,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import {
  guardTool,
  guardToolNode,
  langgraphAgentContext,
} from "@arcjet/guard/langgraph/v1";
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
// with arcjetDenied: true — the helper does not throw. ToolNode wraps
// that into a real ToolMessage whose status is "success" (the tool did
// not throw). The denial is in the payload, not the envelope.
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

const lookupOrder = guardTool(
  arcjet,
  lookupOrderTool,
  {
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
  },
);

// Unwrapped tool: gated by guardToolNode, not guardTool. Do not also wrap
// this with guardTool or @arcjet/guard/vercel-ai/v7 — that would double-call
// Guard or throw on a second brand.
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

// guardToolNode guards tools in place and returns the same node. Do not
// copy the node: ToolNode resolves tools through a constructor-captured
// closure, so a copy would leave the original tools unguarded.
const toolNode = guardToolNode(
  arcjet,
  new ToolNode(tools),
  {
  action: ({ toolName }) => `${toolName}.invoked`,
  onGuardError: "deny",
  rules: ({ toolName, input }) => {
    // lookup_order is already branded by guardTool. guardToolNode skips
    // that brand so Guard is not double-called — this branch is belt and
    // braces if a future tool is added unwrapped.
    if (toolName !== NOTIFY_WAREHOUSE_TOOL) {
      return [];
    }
    const orderId = readOrderId(input) ?? toolName;
    return [warehouseLimit({ key: `order:${orderId}`, requested: 1 })];
  },
});

function model() {
  const id = process.env.LANGGRAPH_MODEL ?? "gpt-4o-mini";
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
  }).bindTools(tools);
}

/**
 * interrupt() / interrupt_before is human-in-the-loop, not a policy gate.
 * Same trap as Mastra requireApproval and Claude canUseTool. There is no
 * guardInterrupt. This pause does not replace guardTool / guardToolNode —
 * tools still run through ToolNode after resume, where Guard is the deny
 * point. Graph hooks and HITL cannot stop tool.invoke.
 */
function hitlNode(
  state: typeof MessagesAnnotation.State,
  config?: { configurable?: { thread_id?: string } },
) {
  // interrupt() needs a checkpointer + thread_id. Without a caller-owned
  // id the run is uncorrelated and this node is a no-op — we still do
  // not mint one.
  if (typeof config?.configurable?.thread_id !== "string") {
    return {};
  }
  const last = lastAiMessage(state.messages);
  const toolNames = last?.tool_calls?.map((call: { name: string }) => call.name) ?? [];
  interrupt({
    kind: "human-pause",
    message:
      "Human-in-the-loop pause before tools. This is not a deny. Guard still evaluates in ToolNode.",
    toolNames,
  });
  return {};
}

async function agentNode(state: typeof MessagesAnnotation.State) {
  const response = await model().invoke([
    { role: "system", content: SYSTEM_PROMPT },
    ...state.messages,
  ]);
  return { messages: [response] };
}

// Graph API (StateGraph + ToolNode). Do not use createReactAgent — it is
// deprecated in LangGraph JS v1 in favor of LangChain createAgent /
// wrapToolCall. That is a later adapter, not this example.
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", agentNode)
  .addNode("hitl", hitlNode)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", toolsCondition, {
    tools: "hitl",
    [END]: END,
  })
  .addEdge("hitl", "tools")
  .addEdge("tools", "agent");

const checkpointer = new MemorySaver();
const graph = workflow.compile({ checkpointer });
// interrupt() requires a checkpointer. Uncorrelated runs (no caller
// thread_id) skip HITL rather than minting an id for the checkpointer.
const graphBare = workflow.compile();

export interface AgentRunInput {
  prompt: string;
  /** Caller-owned conversation id. Copied onto configurable.thread_id. Never minted. */
  threadId?: string;
}

export interface AgentRunResult {
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string };
  hitlPauses: unknown[];
  correlationId?: string;
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  // Preference order inside langgraphAgentContext: thread_id → run id →
  // checkpoint_ns. Do not call createAgentContext — that would mint a
  // second id and split the Sequence. If no valid id is present the call
  // is uncorrelated.
  const config =
    input.threadId === undefined
      ? {}
      : { configurable: { thread_id: input.threadId } };
  const compiled = input.threadId === undefined ? graphBare : graph;
  const ctx = langgraphAgentContext(config);

  // There is no guardInbound. Screen prompt injection in the app before
  // graph.invoke (or in the first graph node). Fail closed: a DENY or an
  // unevaluable guard blocks the turn instead of sending untrusted text
  // to the model.
  const inbound = await screenInbound(input.prompt, config);
  if (inbound !== undefined) {
    return {
      message: inbound.message,
      toolResults: [],
      inboundBlocked: { reason: inbound.reason },
      hitlPauses: [],
      correlationId: ctx.correlationId,
    };
  }

  let result = await compiled.invoke(
    { messages: [new HumanMessage(input.prompt)] },
    config,
  );

  // Auto-resume HITL so the one-click demos still finish. The pause is
  // recorded so the page can show that interrupt() is not a deny.
  const hitlPauses: unknown[] = [];
  for (let turn = 0; turn < 8; turn += 1) {
    const paused = readInterrupts(result);
    if (paused.length === 0) {
      break;
    }
    hitlPauses.push(...paused);
    result = await compiled.invoke(new Command({ resume: true }), config);
  }

  return {
    message: readLastAiText(result.messages),
    toolResults: collectToolResults(result.messages),
    hitlPauses,
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
      ...langgraphAgentContext(config),
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
    // ToolNode wraps a non-throwing denial as ToolMessage status
    // "success". Do not read message.status — the denial is
    // arcjetDenied on the payload.
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

function readInterrupts(result: unknown): unknown[] {
  if (typeof result !== "object" || result === null) {
    return [];
  }
  if (!("__interrupt__" in result)) {
    return [];
  }
  const interrupts = result.__interrupt__;
  return Array.isArray(interrupts) ? interrupts : [interrupts];
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
