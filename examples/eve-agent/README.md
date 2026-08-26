<!-- markdownlint-disable MD033 MD041 -->
<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

# Arcjet example: Vercel Eve agent

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This is an example [Vercel Eve](https://eve.vercel.com/) agent protected by
[Arcjet AI guardrails](https://docs.arcjet.com/ai-guardrails). It demonstrates a
simple agent that looks up orders, consults an API, receives inbound webhook
messages, and records every guard decision with Arcjet.

## Features

- [AI guardrails](https://docs.arcjet.com/ai-guardrails) with the
  [`@arcjet/guard`](https://docs.arcjet.com/ai-guardrails) package protect an
  Eve agent's tools, connections, and inbound channels from abuse.
- An authored tool (`lookup_order`) guarded with `guardTool` uses a
  [token bucket rate limit](https://docs.arcjet.com/rate-limiting/quick-start)
  keyed by order number.
- An OpenAPI connection (the `orders` API) guarded with `guardApproval`
  rate-limits API access per session.
- An HTTP channel screens inbound webhook messages with `guardInbound` and
  [prompt injection detection](https://docs.arcjet.com/redact/concepts) before
  dispatching to the agent.
- Hooks (`arcjetHooks`) capture every guard decision for audit trails.
- Two correlated Sequences per conversation — the inbound screen and the
  in-session decisions — joined by an `eve.session-started` record.

## Run locally

1. [Register for a free Arcjet account](https://console.arcjet.com).

2. Install dependencies:

   ```bash
   npm ci
   ```

   This example requires **Node.js 24 or later** — Eve's floor is Node 24 and
   earlier versions lack required language features and APIs.

3. Rename `.env.local.example` to `.env.local` and add your keys:

   ```bash
   cp .env.local.example .env.local
   ```

   See [Setup](#setup) below for details on the required keys.

4. Start the agent in development mode:

   ```bash
   npm run dev
   ```

5. Send a POST request to the webhook channel (for example, to
   `http://localhost:3000/webhook` if running locally) with a JSON body
   containing your `message` and a `conversationId`. The agent processes it and
   responds.

### Setup

This example needs two keys, both set in `.env.local`:

- `ARCJET_KEY` — your Arcjet site key. Get it from
  [https://console.arcjet.com](https://console.arcjet.com) by creating a free dev site.
- `AI_GATEWAY_API_KEY` — used by Eve to call the model that powers the agent.
  Get it from the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway).

An optional `ORDERS_API_BASE_URL` points the orders connection at a real API. It
defaults to a non-routable placeholder, so the connection is safe to leave
unconfigured while you explore the guardrails.

## Observing the run

Watch the Arcjet Console for the captured decisions:

- **Inbound decision:** the `guardInbound` gate screening the webhook message,
  correlated by the conversation id, on its own Sequence.
- **Tool and connection gates:** the `guardTool` rate limit on `lookup_order`
  and the `guardApproval` gate on the orders API connection.
- **Hook capture:** `arcjetHooks` recording all guard decisions for audit.

### Understanding correlation IDs

The inbound decision and the tool/connection gate decisions are joined by **two
distinct correlation IDs**, reconciled by the `arcjetHooks` record at
`session.started`:

1. **Inbound correlation ID** — the `guardInbound` gate assigns a correlation ID
   passed from the webhook handler. This ID is immutable and comes from the
   caller (e.g. the `conversationId` in the request body), ensuring the same
   request always joins to the same decision even if the session is recreated.

2. **Session correlation ID** — once the inbound decision passes, the handler
   creates a session and runs the agent. The tools and connection gate their
   decisions using the **session id**, not the inbound id. Those land on one
   Sequence; the inbound decision is on a second one. `arcjetHooks` emits an
   `eve.session-started` capture carrying both, which is what lets you pivot
   from either Sequence to the other. Eve namespaces continuation tokens per
   channel, so that record's `eve.continuation-token` reads
   `<channel-name>:<conversation-id>` rather than the bare conversation id.

So the Console shows **two** Sequences per conversation — one for the inbound
screen, one for everything inside the session — joined by the
`eve.session-started` record. Two ids is the expected shape here, not a bug: the
channel boundary runs before Eve creates the session, so there is no session id
to correlate by yet.

### Notes

- The example uses an HTTP channel for simplicity and to avoid external
  dependencies. Swap it for a Slack channel by changing
  `agent/channels/webhook.ts` and adding Slack credentials to `.env.local`.
- The orders API connection is configured with a placeholder endpoint by
  default. To test against a real API, update `agent/connections/orders.ts` and
  set `ORDERS_API_BASE_URL` in `.env.local`.

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
