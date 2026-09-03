import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { z } from "zod";
import { runAgent } from "./lib/agent.ts";

const conversationIdSchema = z
  .string()
  .min(1)
  .max(256)
  // Same 1–256 printable-ASCII window tanstackAiContext accepts.
  .regex(/^[\x20-\x7E]+$/);

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  // Caller-owned id only. Copied onto chat({ context: { sessionId } }).
  // Never minted. Never ctx.threadId.
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

const MODEL_KEY_REQUIRED =
  "AI_GATEWAY_API_KEY or OPENAI_API_KEY is required";

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(page);
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/agent") {
    response.writeHead(404).end();
    return;
  }

  try {
    const input = requestSchema.parse(await readJson(request));

    const generated = await runAgent({
      prompt: input.message,
      sessionId: input.conversationId,
    });

    sendJson(response, 200, {
      message: generated.message,
      inboundBlocked: generated.inboundBlocked,
      toolResults: generated.toolResults,
      correlationId: generated.correlationId,
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

if (!process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY) {
  throw new Error(MODEL_KEY_REQUIRED);
}

const port = Number(process.env.PORT ?? 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`TanStack AI agent example listening on http://localhost:${port}`);
});
