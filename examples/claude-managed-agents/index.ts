import { claudeManagedAgentsContext } from "@arcjet/guard/claude-managed-agents/v0";
import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { z } from "zod";
import { runAgent } from "./lib/agent.ts";

function requestPath(url: string | undefined): string {
  if (url === undefined) {
    return "";
  }
  return new URL(url, "http://localhost").pathname;
}

const conversationIdSchema = z
  .string()
  .min(1)
  .max(256)
  // Same 1–256 printable-ASCII window claudeManagedAgentsContext accepts.
  .regex(/^[\x20-\x7E]+$/);

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  // Caller-owned id only. Copied onto
  // claudeManagedAgentsContext({ correlationId }). Never minted. Never
  // an Anthropic session/event id.
  conversationId: conversationIdSchema.optional(),
});

const page = await readFile(new URL("./index.html", import.meta.url), "utf8");
const MAX_JSON_BODY_BYTES = 32 * 1024;

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_JSON_BODY_BYTES) {
      request.destroy();
      throw new Error("Request body too large");
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SyntaxError("Invalid JSON body");
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

function asPrintableId(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value.length < 1 || value.length > 256 || /[^\x20-\x7E]/.test(value)) {
    return undefined;
  }
  return value;
}

const server = createServer(async (request, response) => {
  const pathname = requestPath(request.url);

  if (request.method === "GET" && pathname === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(page);
    return;
  }

  if (request.method !== "POST" || pathname !== "/api/agent") {
    response.writeHead(404).end();
    return;
  }

  try {
    const input = requestSchema.parse(await readJson(request));
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is required");
    }

    // The page may generate a conversation id. The server only copies it
    // onto claudeManagedAgentsContext({ correlationId }). Never
    // randomUUID() here. Never treat Anthropic session/event ids as if
    // we created them.
    const conversationId = asPrintableId(input.conversationId);
    const ctx = claudeManagedAgentsContext(
      conversationId === undefined
        ? undefined
        : { correlationId: conversationId },
    );

    const generated = await runAgent({
      prompt: input.message,
      conversationId,
    });

    sendJson(response, 200, {
      message: generated.message,
      inboundBlocked: generated.inboundBlocked,
      toolResults: generated.toolResults,
      correlationId: ctx.correlationId ?? generated.correlationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(response, statusForError(error), { message });
  }
});

function statusForError(error: unknown): number {
  if (error instanceof Error && error.message === "Request body too large") {
    return 413;
  }
  if (error instanceof SyntaxError || error instanceof z.ZodError) {
    return 400;
  }
  return 500;
}

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error(
    `PORT must be an integer between 0 and 65535, got ${process.env.PORT}`,
  );
}
server.listen(port, "0.0.0.0", () => {
  console.log(
    `Claude Managed Agents example listening on http://localhost:${port}`,
  );
});
