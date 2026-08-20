import { genkitContext } from "@arcjet/guard/genkit/v1";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "genkit";
import { runAgent } from "./lib/agent.ts";

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  // Caller-owned ids only. Copied onto generate({ context: { sessionId } }).
  // genkitContext reads them; it never mints one.
  conversationId: z.string().min(1).max(256).optional(),
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
      throw new Error("Request body too large");
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

function asPrintableId(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  // Same 1–256 printable-ASCII window genkitContext accepts.
  if (value.length < 1 || value.length > 256 || /[^\x20-\x7E]/.test(value)) {
    return undefined;
  }
  return value;
}

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
    if (!process.env.AI_GATEWAY_API_KEY) {
      throw new Error("AI_GATEWAY_API_KEY is required");
    }

    // The page may generate a conversation id in the browser. The server
    // only copies that value onto generate({ context: { sessionId } }).
    // Never randomUUID() per request here. Never call createAgentContext.
    // Never read Session.sessionId from a Session constructed without
    // an id — that class mints a UUID.
    const sessionId = asPrintableId(input.conversationId);
    const ctx = genkitContext(
      sessionId === undefined ? undefined : { context: { sessionId } },
    );

    const generated = await runAgent({
      prompt: input.message,
      sessionId,
    });

    sendJson(response, 200, {
      message: generated.message,
      inboundBlocked: generated.inboundBlocked,
      finishReason: generated.finishReason,
      toolResults: generated.toolResults,
      correlationId: ctx.correlationId ?? generated.correlationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(response, message === "Request body too large" ? 413 : 500, {
      message,
    });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`Genkit agent example listening on http://localhost:${port}`);
});
