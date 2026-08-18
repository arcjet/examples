import { createAgentContext, securityMetadata } from "@arcjet/guard/vercel-ai/v7";
import { start } from "workflow/api";
import { NextResponse } from "next/server";
import { arcjet, startLimit } from "@/lib/arcjet";
import { supportAgentWorkflow } from "@/workflows/support-agent";

const MAX_QUESTION_LENGTH = 2000;

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "anonymous";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { question } = body as { question?: unknown };

  if (!question || typeof question !== "string") {
    return new Response("Missing or invalid question parameter", { status: 400 });
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return new Response("Question is too long", { status: 400 });
  }

  // One context per run; its correlation ID joins every guard decision and
  // capture event this run produces. Pass an existing ID (e.g. a ticket or
  // request ID) instead to join Arcjet data to your own systems.
  // createAgentContext returns a plain { correlationId, metadata } record so
  // the workflow input stays JSON-serializable for durable replay.
  const ctx = createAgentContext({
    metadata: securityMetadata({
      agent: "support-agent",
      workflow: "support-request",
    }),
  });

  const decision = await arcjet.guard({
    label: "workflow.started",
    rules: [startLimit({ key: clientKey(request) })],
    correlationId: ctx.correlationId,
  });

  if (decision.conclusion === "DENY") {
    return new Response("Too many requests", { status: 429 });
  }

  const run = await start(supportAgentWorkflow, [{ question, ctx }]);

  return NextResponse.json({
    runId: run.runId,
    correlationId: ctx.correlationId,
  });
}
