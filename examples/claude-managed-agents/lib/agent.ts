import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import {
  claudeManagedAgentsContext,
  guardCustomTool,
  guardEvents,
  type ClaudeManagedAgentsContext,
  type ManagedAgentsRunnableTool,
} from "@arcjet/guard/claude-managed-agents/v0";
import { arcjet, detectInjection, detectPii, lookupLimit } from "./arcjet.ts";

const LOOKUP_ORDER_TOOL = "lookup_order";

const SYSTEM_PROMPT =
  "You are a support agent. Use lookup_order for order questions. " +
  "If a tool call is denied by security policy, do not retry it; explain " +
  "the denial to the user or try a different approach.";

const SESSION_TIMEOUT_MS = 60_000;

export interface AgentRunInput {
  prompt: string;
  /**
   * Caller-owned conversation id. Copied onto
   * `claudeManagedAgentsContext({ correlationId })`. Never minted. Never
   * an Anthropic `session.id` / event id (`sesn_…`, `sevt_…`).
   */
  conversationId?: string;
}

export interface AgentRunResult {
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string; outcome: "DENY" | "UNAVAILABLE" };
  correlationId?: string;
}

function anthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }
  return new Anthropic({ apiKey });
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

function customToolRules(input: { [key: string]: unknown }) {
  const orderId = readOrderId(input) ?? LOOKUP_ORDER_TOOL;
  const note = readNote(input);
  return [
    lookupLimit({ key: `order:${orderId}`, requested: 1 }),
    // Scan free-text args only. An opaque orderId will not trip EMAIL /
    // phone / card / IP.
    ...(note !== undefined ? [detectPii(note)] : []),
  ];
}

/**
 * Self-hosted EnvironmentWorker path: wrap `betaTool({ run })` with the
 * same `guardCustomTool`. The CLI worker cannot register custom tools.
 * This wrap is not used by the hosted SSE loop below — shown so the
 * adapter contract is in the example. Do not also wrap this with
 * `@arcjet/guard/claude-agent-sdk/v0` / `guardTool`.
 */
export const lookupOrderWorkerTool = guardCustomTool(
  arcjet,
  // betaTool({ run }) is the EnvironmentWorker factory. The SDK types
  // `run`'s context narrower than the adapter's `unknown`, so the wrap
  // is asserted to the structural ManagedAgentsRunnableTool the helper
  // accepts. Runtime still wraps this object's `run`.
  betaTool({
    name: LOOKUP_ORDER_TOOL,
    description:
      "Look up an order by ID. Include a note when the user supplies one.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        note: { type: "string" },
      },
      required: ["orderId"],
    },
    run: async ({ orderId, note }) =>
      JSON.stringify(
        lookupOrderRecord(orderId, typeof note === "string" ? note : undefined),
      ),
  }) as ManagedAgentsRunnableTool<{ orderId: string; note?: string }, string>,
  {
    action: "order.looked-up",
    onGuardError: "deny",
    rules: customToolRules,
  },
);

type CachedResources = {
  agentId: string;
  agentVersion: number;
  environmentId: string;
};

let cachedResources: Promise<CachedResources> | undefined;

async function ensureResources(client: Anthropic): Promise<CachedResources> {
  if (cachedResources !== undefined) {
    return cachedResources;
  }

  cachedResources = (async () => {
    // Agents and environments are persisted server-side. Create once per
    // process — not on every /api/agent request.
    const agent = await client.beta.agents.create({
      name: "arcjet-support-agent",
      model: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6",
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: "custom",
          name: LOOKUP_ORDER_TOOL,
          description:
            "Look up an order by ID. Include a note when the user supplies one.",
          input_schema: {
            type: "object",
            properties: {
              orderId: { type: "string" },
              note: { type: "string" },
            },
            required: ["orderId"],
          },
        },
        // Do not add `agent_toolset_20260401` as if Guard can deny it.
        // Default permission_policy: always_allow cannot gate
        // Anthropic-cloud bash / read / write. web_search / web_fetch
        // always run on Anthropic. always_ask / user.tool_confirmation
        // is HITL, not a policy gate — do not make that the happy path.
      ],
    });

    const environment = await client.beta.environments.create({
      name: "arcjet-support-env",
      config: { type: "cloud", networking: { type: "unrestricted" } },
    });

    return {
      agentId: agent.id,
      agentVersion: agent.version,
      environmentId: environment.id,
    };
  })();

  try {
    return await cachedResources;
  } catch (error) {
    cachedResources = undefined;
    throw error;
  }
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  // Derived once and reused: claudeManagedAgentsContext reads a
  // caller-owned correlationId and never mints. Never pass session.id
  // or event ids as if we created them. Never traceId. Do not call
  // createAgentContext.
  const ctx = claudeManagedAgentsContext({
    correlationId: input.conversationId,
  });

  const client = anthropicClient();
  const resources = await ensureResources(client);
  const session = await client.beta.sessions.create({
    agent: {
      type: "agent",
      id: resources.agentId,
      version: resources.agentVersion,
    },
    environment_id: resources.environmentId,
  });

  const events = [
    {
      type: "user.message" as const,
      content: [{ type: "text" as const, text: input.prompt }],
    },
  ];

  // No guardInbound. Gate user.message / initial_events with
  // guardEvents BEFORE sessions.events.send (the same helper also
  // gates sessions.create({ initial_events }) — pass those events
  // and create only on ALLOW). guardEvents is fail-closed: it
  // already treats guard() hasFailedOpen() / throw as UNAVAILABLE
  // and does not send. protect() / guard() stay fail-open if you
  // call them yourself — check hasFailedOpen() in that case.
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
    (body) => client.beta.sessions.events.send(session.id, body),
  );

  if (!verdict.allowed) {
    return {
      message: verdict.message,
      toolResults: [],
      inboundBlocked: { reason: verdict.message, outcome: verdict.outcome },
      correlationId: ctx.correlationId,
    };
  }

  return await drainSession({
    client,
    sessionId: session.id,
    ctx,
  });
}

async function drainSession(params: {
  client: Anthropic;
  sessionId: string;
  ctx: ClaudeManagedAgentsContext;
}): Promise<AgentRunResult> {
  const { client, sessionId, ctx } = params;
  const toolResults: unknown[] = [];
  const messageParts: string[] = [];
  const stream = await client.beta.sessions.events.stream(sessionId);
  const deadline = AbortSignal.timeout(SESSION_TIMEOUT_MS);

  try {
    for await (const event of stream) {
      if (deadline.aborted) {
        break;
      }

      if (event.type === "agent.message") {
        collectAgentText(event, messageParts);
        continue;
      }

      if (event.type === "agent.custom_tool_use") {
        // Hosted path: Guard before execute. On deny the tool does
        // not run and send() posts a real user.custom_tool_result
        // with is_error: true. Anthropic has already chosen the
        // tool; this is the customer-side gate for tools you
        // execute.
        const gated = await guardCustomTool(
          arcjet,
          {
            event,
            execute: async (args) => {
              const orderId = readOrderId(args);
              if (orderId === undefined) {
                throw new Error("lookup_order requires orderId");
              }
              return lookupOrderRecord(orderId, readNote(args));
            },
            send: (result) =>
              client.beta.sessions.events.send(sessionId, {
                events: [result],
              }),
          },
          {
            action: "order.looked-up",
            onGuardError: "deny",
            rules: customToolRules,
            context: ctx,
          },
        );

        if (gated.allowed) {
          const success = {
            type: "user.custom_tool_result" as const,
            custom_tool_use_id: event.id,
            content: [
              { type: "text" as const, text: JSON.stringify(gated.output) },
            ],
          };
          await client.beta.sessions.events.send(sessionId, {
            events: [success],
          });
          toolResults.push({
            name: event.name,
            arcjetDenied: false,
            content: gated.output,
          });
        } else {
          toolResults.push({
            name: event.name,
            arcjetDenied: true,
            content: gated.result,
          });
        }
        continue;
      }

      if (event.type === "session.status_terminated") {
        break;
      }

      // Idle waiting for a custom-tool result is not end of turn.
      // Only stop when the agent finished the user turn.
      if (
        event.type === "session.status_idle" &&
        event.stop_reason?.type === "end_turn"
      ) {
        break;
      }
    }
  } finally {
    await stream.controller.abort();
  }

  return {
    message: messageParts.join(""),
    toolResults,
    correlationId: ctx.correlationId,
  };
}

function collectAgentText(event: unknown, parts: string[]) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOrderId(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) {
    return undefined;
  }
  const record = input as { orderId?: unknown; order_id?: unknown };
  const orderId = record.orderId ?? record.order_id;
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
