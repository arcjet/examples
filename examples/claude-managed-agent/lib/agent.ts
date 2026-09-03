import Anthropic from "@anthropic-ai/sdk";
import {
  claudeManagedAgentsContext,
  guardCustomTool,
  guardEvents,
  type AgentCustomToolUseEvent,
  type ClaudeManagedAgentsContext,
} from "@arcjet/guard/claude-managed-agents/v0";
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

export interface AgentRunInput {
  prompt: string;
  /**
   * Caller-owned conversation id. Passed to claudeManagedAgentsContext as
   * correlationId. Never minted. Never an Anthropic session / event id
   * (`sesn_…`, `sevt_…`).
   */
  conversationId?: string;
}

export interface AgentRunResult {
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string };
  correlationId?: string;
}

let client: Anthropic | undefined;
let harness: { agentId: string; environmentId: string } | undefined;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }
  client ??= new Anthropic();
  return client;
}

export function hasAnthropicKey(): boolean {
  return (
    typeof process.env.ANTHROPIC_API_KEY === "string" &&
    process.env.ANTHROPIC_API_KEY.length > 0
  );
}

async function getHarness(): Promise<{ agentId: string; environmentId: string }> {
  const agentId = process.env.CLAUDE_MANAGED_AGENT_ID;
  const environmentId = process.env.CLAUDE_MANAGED_ENVIRONMENT_ID;
  if (
    typeof agentId === "string" &&
    agentId.length > 0 &&
    typeof environmentId === "string" &&
    environmentId.length > 0
  ) {
    return { agentId, environmentId };
  }

  if (harness !== undefined) {
    return harness;
  }

  const anthropic = getClient();
  const model = process.env.CLAUDE_MANAGED_MODEL ?? "claude-sonnet-4-5";

  const [agent, environment] = await Promise.all([
    anthropic.beta.agents.create({
      name: "arcjet-support-agent",
      model,
      system: SYSTEM_PROMPT,
      // Built-in agent_toolset_20260401 defaults to always_allow. Anthropic
      // runs bash / files in its sandbox with no customer pre-exec. There
      // is no PreToolUse and no canUseTool on this adapter. This demo
      // registers only custom tools the app executes.
      tools: [
        {
          type: "custom",
          name: LOOKUP_ORDER_TOOL,
          description:
            "Look up an order by ID. Include a note when the user supplies one.",
          input_schema: {
            type: "object",
            properties: {
              orderId: { type: "string", description: "Order identifier" },
              note: {
                type: "string",
                description: "Optional free-text note from the user",
              },
            },
            required: ["orderId"],
          },
        },
        {
          type: "custom",
          name: NOTIFY_WAREHOUSE_TOOL,
          description: "Notify the warehouse that an order is ready to pick.",
          input_schema: {
            type: "object",
            properties: {
              orderId: { type: "string", description: "Order identifier" },
            },
            required: ["orderId"],
          },
        },
      ],
    }),
    anthropic.beta.environments.create({
      name: "arcjet-support-env",
      config: {
        type: "cloud",
        networking: { type: "unrestricted" },
      },
    }),
  ]);

  harness = { agentId: agent.id, environmentId: environment.id };
  return harness;
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  // Caller-owned id only. Anthropic session.id is never a correlation
  // source — claudeManagedAgentsContext ignores it.
  const ctx = claudeManagedAgentsContext(
    input.conversationId === undefined
      ? undefined
      : { correlationId: input.conversationId },
  );

  const anthropic = getClient();
  const { agentId, environmentId } = await getHarness();
  const session = await anthropic.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
    title: "Arcjet support demo",
  });

  const events = [
    {
      type: "user.message" as const,
      content: [{ type: "text" as const, text: input.prompt }],
    },
  ];

  // Open the stream before sending so we do not miss custom_tool_use.
  const stream = await anthropic.beta.sessions.events.stream(session.id);

  // There is no guardInbound and no UserPromptSubmit. Screen on
  // guardEvents before events.send. On DENY, send is not called.
  const verdict = await guardEvents(
    arcjet,
    {
      events,
      inbound: {
        action: "message.received",
        onGuardError: "deny",
        rules: ({ text }) => [detectInjection(text)],
      },
      context: ctx,
    },
    (body) => anthropic.beta.sessions.events.send(session.id, body),
  );

  if (!verdict.allowed) {
    return {
      message: verdict.message,
      toolResults: [],
      inboundBlocked: { reason: verdict.outcome },
      correlationId: ctx.correlationId,
    };
  }

  const toolResults: unknown[] = [];
  const messageParts: string[] = [];
  let pendingCustomTools = 0;

  for await (const event of stream) {
    if (event.type === "agent.message") {
      collectMessageText(event, messageParts);
      continue;
    }

    if (isCustomToolUseEvent(event)) {
      pendingCustomTools += 1;
      const handled = await handleCustomTool(anthropic, session.id, event, ctx);
      toolResults.push(handled);
      pendingCustomTools -= 1;
      continue;
    }

    if (event.type === "session.status_idle" && pendingCustomTools === 0) {
      break;
    }
  }

  return {
    message: messageParts.join(""),
    toolResults,
    correlationId: ctx.correlationId,
  };
}

async function handleCustomTool(
  anthropic: Anthropic,
  sessionId: string,
  event: AgentCustomToolUseEvent,
  ctx: ClaudeManagedAgentsContext,
): Promise<unknown> {
  const send = (result: {
    type: "user.custom_tool_result";
    custom_tool_use_id: string;
    content?: Array<{ type: "text"; text: string }>;
    is_error?: boolean | null;
    session_thread_id?: string | null;
  }) => anthropic.beta.sessions.events.send(sessionId, { events: [result] });

  if (event.name === LOOKUP_ORDER_TOOL) {
    const gated = await guardCustomTool(
      arcjet,
      {
        event,
        execute: async (input) => lookupOrderRecord(input),
        send,
      },
      {
        action: "order.looked-up",
        onGuardError: "deny",
        context: ctx,
        rules: (input) => {
          const orderId = readString(input.orderId) ?? LOOKUP_ORDER_TOOL;
          const note = readString(input.note);
          return [
            lookupLimit({ key: `order:${orderId}`, requested: 1 }),
            ...(note !== undefined ? [detectPii(note)] : []),
          ];
        },
      },
    );
    return finishCustomTool(anthropic, sessionId, event, gated);
  }

  if (event.name === NOTIFY_WAREHOUSE_TOOL) {
    const gated = await guardCustomTool(
      arcjet,
      {
        event,
        execute: async (input) => ({
          orderId: readString(input.orderId) ?? "",
          notified: true,
          destination: "warehouse",
        }),
        send,
      },
      {
        action: "warehouse.notified",
        onGuardError: "deny",
        context: ctx,
        rules: (input) => {
          const orderId = readString(input.orderId) ?? NOTIFY_WAREHOUSE_TOOL;
          return [warehouseLimit({ key: `order:${orderId}`, requested: 1 })];
        },
      },
    );
    return finishCustomTool(anthropic, sessionId, event, gated);
  }

  const unknown = {
    type: "user.custom_tool_result" as const,
    custom_tool_use_id: event.id,
    content: [{ type: "text" as const, text: `Unknown tool: ${event.name}` }],
    is_error: true,
  };
  await anthropic.beta.sessions.events.send(sessionId, { events: [unknown] });
  return { name: event.name, arcjetDenied: false, content: unknown };
}

async function finishCustomTool(
  anthropic: Anthropic,
  sessionId: string,
  event: AgentCustomToolUseEvent,
  gated:
    | { allowed: true; output: unknown }
    | { allowed: false; result: { is_error?: boolean | null } },
): Promise<unknown> {
  if (!gated.allowed) {
    return {
      name: event.name,
      arcjetDenied: true,
      content: gated.result,
    };
  }

  await anthropic.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: "user.custom_tool_result",
        custom_tool_use_id: event.id,
        content: [{ type: "text", text: JSON.stringify(gated.output) }],
      },
    ],
  });
  return {
    name: event.name,
    arcjetDenied: false,
    content: gated.output,
  };
}

function lookupOrderRecord(input: { [key: string]: unknown }) {
  const orderId = readString(input.orderId) ?? "";
  const note = readString(input.note);
  return {
    orderId,
    status: "shipped",
    carrier: "ACME Post",
    eta: "2 days",
    ...(note !== undefined ? { note } : {}),
  };
}

function collectMessageText(event: unknown, parts: string[]) {
  if (!isRecord(event) || !Array.isArray(event.content)) {
    return;
  }
  for (const block of event.content) {
    if (
      isRecord(block) &&
      block.type === "text" &&
      typeof block.text === "string" &&
      block.text.length > 0
    ) {
      parts.push(block.text);
    }
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCustomToolUseEvent(value: unknown): value is AgentCustomToolUseEvent {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.type === "agent.custom_tool_use" &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.processed_at === "string" &&
    isRecord(value.input)
  );
}
