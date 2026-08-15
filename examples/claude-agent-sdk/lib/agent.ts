import {
  createSdkMcpServer,
  query,
  tool,
  type HookCallback,
  type HookCallbackMatcher,
  type HookEvent,
  type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { guardHooks, guardTool } from "@arcjet/guard/claude-agent-sdk/v0";
import { z } from "zod";
import {
  arcjet,
  detectInjection,
  builtinLimit,
  detectPii,
  lookupLimit,
  warehouseLimit,
} from "./arcjet.ts";

const MCP_SERVER = "app";
const LOOKUP_ORDER_TOOL = "lookup_order";
const NOTIFY_WAREHOUSE_TOOL = "notify_warehouse";

export const LOOKUP_MCP_TOOL = `mcp__${MCP_SERVER}__${LOOKUP_ORDER_TOOL}`;
export const NOTIFY_MCP_TOOL = `mcp__${MCP_SERVER}__${NOTIFY_WAREHOUSE_TOOL}`;

// Authored tool: wrap with guardTool. DENY is a CallToolResult with
// isError: true — do not throw.
const lookupOrder = guardTool(
  arcjet,
  tool(
    LOOKUP_ORDER_TOOL,
    "Look up an order by ID. Include a note when the user supplies one.",
    {
      orderId: z.string(),
      note: z.string().optional(),
    },
    async ({ orderId, note }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(lookupOrderRecord(orderId, note)),
        },
      ],
    }),
  ),
  {
    action: "order.looked-up",
    // Fail closed: if Arcjet is unreachable the handler does not run and
    // the model receives isError: true with reason ERROR.
    onGuardError: "deny",
    rules: ({ orderId, note }) => [
      lookupLimit({ key: `order:${orderId}`, requested: 1 }),
      // Scan free-text args only. An opaque orderId will not trip EMAIL /
      // phone / card / IP, so do not pass it here.
      ...(typeof note === "string" && note.length > 0 ? [detectPii(note)] : []),
    ],
  },
);

// Unwrapped MCP tool: gated by guardHooks PreToolUse, not guardTool. Do
// not also wrap this with @arcjet/guard/vercel-ai/v7 — Claude tools are
// tool(), not AI SDK tool(), and double-wrapping throws.
const notifyWarehouse = tool(
  NOTIFY_WAREHOUSE_TOOL,
  "Notify the warehouse that an order is ready to pick.",
  {
    orderId: z.string(),
  },
  async ({ orderId }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          orderId,
          notified: true,
          destination: "warehouse",
        }),
      },
    ],
  }),
);

const mcpServer = createSdkMcpServer({
  name: MCP_SERVER,
  tools: [lookupOrder, notifyWarehouse],
});

const SYSTEM_PROMPT =
  "You are a support agent. Use lookup_order for order questions and " +
  "notify_warehouse when the user asks to notify the warehouse. " +
  "If a tool call is denied by security policy, do not retry it; explain " +
  "the denial to the user or try a different approach. Do not use Bash, " +
  "Write, or other built-in tools.";

export interface AgentRunInput {
  prompt: string;
  /** Caller-owned session id. Passed to query() and guardHooks. Never minted. */
  sessionId?: string;
}

export interface AgentRunResult {
  message: string;
  toolResults: unknown[];
  inboundBlocked?: { reason: string };
  sessionId?: string;
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const hooks = skipAuthoredPreToolUse(
    guardHooks(arcjet, {
      sessionId: input.sessionId,
      action: ({ toolName }) => `${toolName}.invoked`,
      onGuardError: "deny",
      rules: ({ toolName, input: toolInput }) => {
        // Authored lookup_order is already wrapped with guardTool. Skip
        // submitting rules here; skipAuthoredPreToolUse also short-circuits
        // the hook so the same tool is not double-gated.
        if (isLookupTool(toolName)) {
          return [];
        }
        if (isNotifyTool(toolName)) {
          const orderId = readOrderId(toolInput) ?? toolName;
          return [warehouseLimit({ key: `order:${orderId}`, requested: 1 })];
        }
        // Built-ins (Bash, Write, …) and any other unwrapped tool share
        // this PreToolUse path. A tight bucket means the first call is
        // denied so the demo can show permissionDecision: "deny".
        return [builtinLimit({ key: `builtin:${toolName}`, requested: 100 })];
      },
      inbound: {
        action: "message.received",
        onGuardError: "deny",
        rules: ({ prompt }) => [detectInjection(prompt)],
      },
    }),
  );

  const toolResults: unknown[] = [];
  let message = "";
  let inboundBlocked: { reason: string } | undefined;
  let sessionId = input.sessionId;

  const options: NonNullable<Parameters<typeof query>[0]["options"]> = {
    persistSession: false,
    settingSources: [],
    strictMcpConfig: true,
    systemPrompt: SYSTEM_PROMPT,
    mcpServers: { [MCP_SERVER]: mcpServer },
    allowedTools: [LOOKUP_MCP_TOOL, NOTIFY_MCP_TOOL],
    tools: [LOOKUP_MCP_TOOL, NOTIFY_MCP_TOOL],
    hooks,
    includeHookEvents: true,
    maxTurns: 8,
  };

  if (input.sessionId !== undefined) {
    options.sessionId = input.sessionId;
  }

  if (process.env.CLAUDE_MODEL) {
    options.model = process.env.CLAUDE_MODEL;
  }

  for await (const event of query({
    prompt: input.prompt,
    options,
  })) {
    sessionId = readSessionId(event) ?? sessionId;
    collectToolResults(event, toolResults);
    const blocked = readInboundBlock(event);
    if (blocked) {
      inboundBlocked = blocked;
    }
    const text = readResultText(event);
    if (text !== undefined) {
      message = text;
    }
  }

  return {
    message,
    toolResults,
    inboundBlocked,
    sessionId,
  };
}

function isLookupTool(toolName: string): boolean {
  return toolName === LOOKUP_ORDER_TOOL || toolName === LOOKUP_MCP_TOOL;
}

function isNotifyTool(toolName: string): boolean {
  return toolName === NOTIFY_WAREHOUSE_TOOL || toolName === NOTIFY_MCP_TOOL;
}

/**
 * guardHooks PreToolUse runs for every tool, including authored MCP tools.
 * Skip lookup_order so guardTool is the only gate for that handler.
 */
function skipAuthoredPreToolUse(
  hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>>,
): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  const matchers = hooks.PreToolUse;
  if (matchers === undefined) {
    return hooks;
  }

  return {
    ...hooks,
    PreToolUse: matchers.map((matcher) => ({
      ...matcher,
      hooks: matcher.hooks.map(
        (hook): HookCallback =>
          async (hookInput, toolUseID, context) => {
            const toolName = readHookToolName(hookInput);
            if (isLookupTool(toolName)) {
              return {};
            }
            return hook(hookInput, toolUseID, context);
          },
      ),
    })),
  };
}

function readHookToolName(input: unknown): string {
  if (typeof input !== "object" || input === null || !("tool_name" in input)) {
    return "";
  }
  return typeof input.tool_name === "string" ? input.tool_name : "";
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

function readSessionId(message: SDKMessage): string | undefined {
  if ("session_id" in message && typeof message.session_id === "string") {
    return message.session_id;
  }
  return undefined;
}

function collectToolResults(message: SDKMessage, toolResults: unknown[]) {
  if (message.type !== "user" || !("message" in message)) {
    return;
  }
  const content = message.message.content;
  if (!Array.isArray(content)) {
    return;
  }
  for (const block of content) {
    if (
      typeof block === "object" &&
      block !== null &&
      "type" in block &&
      block.type === "tool_result"
    ) {
      toolResults.push(block);
    }
  }
}

function readInboundBlock(message: SDKMessage): { reason: string } | undefined {
  if (message.type !== "system") {
    return undefined;
  }

  if (message.subtype === "hook_response" && message.hook_event === "UserPromptSubmit") {
    const output = message.output;
    if (output.includes('"decision":"block"') || output.includes('"decision": "block"')) {
      return { reason: output };
    }
    return undefined;
  }

  if (message.subtype === "informational" && message.prevent_continuation === true) {
    return { reason: message.content };
  }

  return undefined;
}

function readResultText(message: SDKMessage): string | undefined {
  if (message.type !== "result") {
    return undefined;
  }
  if (message.subtype === "success") {
    return message.result;
  }
  if ("errors" in message && Array.isArray(message.errors)) {
    return message.errors.join("\n");
  }
  return undefined;
}
