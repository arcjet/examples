<!-- markdownlint-disable MD033 MD041 -->
<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

# Arcjet example: Next.js AI agent guardrails

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This is an example Next.js application demonstrating
[Arcjet AI guardrails](https://docs.arcjet.com/ai-guardrails) for an AI agent
built with the [Vercel AI SDK](https://sdk.vercel.ai/). A support agent runs
inside a [Vercel Workflow](https://vercel.com/docs/workflows) with a
rate-limited tool, a guarded external action, and a captured side effect, all
joined by a shared correlation ID.

## Features

- [AI guardrails](https://docs.arcjet.com/ai-guardrails) with the
  [`@arcjet/guard`](https://docs.arcjet.com/ai-guardrails) package protect an
  agent's tools and actions from abuse.
- A [rate-limited tool](https://docs.arcjet.com/rate-limiting/quick-start)
  (`lookupOrder`) uses a token bucket to prevent an agent from calling an
  expensive tool too frequently.
- A guarded external action (`ticket.updated`) uses a sliding window rate limit
  to protect a write to an external system, blocking by default if the policy
  cannot be evaluated.
- A captured action (`notification.sent`) records a side effect for audit
  trails.
- A shared correlation ID joins every guard decision and capture event produced
  by a single agent run.

## Run locally

1. [Register for a free Arcjet account](https://app.arcjet.com).

2. Install dependencies:

   ```bash
   npm ci
   ```

3. Rename `.env.local.example` to `.env.local` and add your keys:

   ```bash
   cp .env.local.example .env.local
   ```

   See [Setup](#setup) below for details on the required keys.

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

6. Ask a question about an order, for example: "What's the status of order 42?"

### Setup

This example needs two keys, both set in `.env.local`:

- `ARCJET_KEY` — your Arcjet site key. Get it from
  [https://app.arcjet.com](https://app.arcjet.com) by creating a free dev site.
- `AI_GATEWAY_API_KEY` — used by the Vercel AI SDK to call the model that powers
  the support agent. Get it from the
  [Vercel AI Gateway](https://vercel.com/docs/ai-gateway).

Both keys are required to run the agent: `ARCJET_KEY` authenticates the guard
decisions and `AI_GATEWAY_API_KEY` authenticates the model calls.

## Observing the run

The workflow runs durably in the background, so the route responds immediately
with a `runId` and `correlationId` rather than the agent's answer. Use these to
observe the workflow and guard decisions:

- **Workflow execution:** run `npx workflow inspect runs` to see the workflow
  steps, or `npx workflow web` to open an interactive dashboard.
- **Guard decisions:** visit your Arcjet dashboard and filter by the returned
  `correlationId` to see the `order.looked-up`, `ticket.updated`, and
  `notification.sent` events for this run.

To see the rate limit in action, ask the agent several questions quickly. After
10 token bucket requests (spread across 60 seconds) the `lookupOrder` tool is
denied, and the model receives a structured denial and apologizes instead of
retrying.

Capture is fire-and-forget: events are batched and sent in the background, so a
few seconds can pass before one shows up. Set `ARCJET_LOG_LEVEL=warn` to see the
diagnostics if an event is dropped.

## Need help?

Check out [the docs](https://docs.arcjet.com/), [contact
support](https://docs.arcjet.com/support), or [join our Discord
server](https://arcjet.com/discord).

## Contributing

All development for Arcjet examples is done in the
[`arcjet/examples` repository](https://github.com/arcjet/examples).

You are welcome to open an issue here or in
[`arcjet/examples`](https://github.com/arcjet/examples/issues) directly.
However, please direct all pull requests to
[`arcjet/examples`](https://github.com/arcjet/examples/pulls). Take a look at
our
[contributing guide](https://github.com/arcjet/examples/blob/main/CONTRIBUTING.md)
for more information.
