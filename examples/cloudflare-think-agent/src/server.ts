import {
  cloudflareThinkContext,
  type CloudflareThinkGuardHooks,
} from "@arcjet/guard/cloudflare-think/v0";
import {
  Think,
  type ToolCallContext,
  type TurnContext,
} from "@cloudflare/think";
import {
  createGuardHooks,
  screenInbound,
  SYSTEM_PROMPT,
} from "../lib/agent.ts";

type AgentState = {
  sessionId?: string;
};

/**
 * Cloudflare Think production wiring.
 *
 * There is no `guardTool` and no `@arcjet/guard/vercel-ai/v7` mix-in.
 * The gate is Think `beforeToolCall` via `hooks.beforeToolCall(ctx)`.
 * Default DENY is substitute; optional `onDeny: "block"` is documented
 * on `createGuardHooks`.
 *
 * `needsApproval` is HITL, not a policy gate — after a human yes,
 * Guard still runs here. Do not install approval hooks as the deny.
 *
 * Correlation is the caller-owned id passed to `guardHooks({ sessionId })`.
 * Never mint. Never `toolCallId`. Never Durable Object `name` / `id`.
 */
export class SupportAgent extends Think<Env, AgentState> {
  override getModel() {
    // Replace with Workers AI / AI Gateway / another provider in a
    // hosted Worker. The local HTTP demo calls hooks.beforeToolCall
    // directly and does not instantiate Think.
    return "@cf/moonshotai/kimi-k2.6";
  }

  override getSystemPrompt() {
    return SYSTEM_PROMPT;
  }

  /**
   * Caller-owned session id the integrator put on the turn body or
   * persisted state. Think's Durable Object name and `toolCallId` are
   * never correlation.
   */
  private callerSessionId(body?: Record<string, unknown>): string | undefined {
    return (
      asPrintableId(body?.sessionId) ?? asPrintableId(this.state.sessionId)
    );
  }

  override async beforeTurn(ctx: TurnContext) {
    const sessionId = this.callerSessionId(ctx.body);
    if (sessionId !== undefined && this.state.sessionId !== sessionId) {
      this.setState({ ...this.state, sessionId });
    }

    const text = lastUserText(ctx.messages);
    if (text === undefined) {
      return;
    }
    const inbound = await screenInbound(
      text,
      cloudflareThinkContext({ context: { sessionId } }),
    );
    if (inbound !== undefined) {
      throw new Error(inbound.message);
    }
  }

  override beforeToolCall(
    ctx: ToolCallContext,
  ): ReturnType<CloudflareThinkGuardHooks["beforeToolCall"]> {
    return createGuardHooks(this.callerSessionId()).beforeToolCall(ctx);
  }
}

function lastUserText(messages: readonly unknown[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = asRecord(messages[index]);
    if (message === undefined || message.role !== "user") {
      continue;
    }
    if (typeof message.content === "string" && message.content.length > 0) {
      return message.content;
    }
    if (!Array.isArray(message.parts) && !Array.isArray(message.content)) {
      continue;
    }
    const blocks: unknown[] = Array.isArray(message.parts)
      ? message.parts
      : Array.isArray(message.content)
        ? message.content
        : [];
    const texts: string[] = [];
    for (const part of blocks) {
      if (typeof part === "string" && part.length > 0) {
        texts.push(part);
        continue;
      }
      const record = asRecord(part);
      if (
        record !== undefined &&
        typeof record.text === "string" &&
        record.text.length > 0
      ) {
        texts.push(record.text);
      }
    }
    if (texts.length > 0) {
      return texts.join("");
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function asPrintableId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  if (value.length < 1 || value.length > 256 || /[^\x20-\x7E]/.test(value)) {
    return undefined;
  }
  return value;
}
