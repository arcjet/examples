<!-- markdownlint-disable MD033 MD041 -->
<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

# Arcjet example: Node.js Guard policy

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This is an example Node.js AI agent, built on a plain Node.js `http` server and
the [Vercel AI SDK](https://ai-sdk.dev), that demonstrates a remotely-configured
Arcjet Guard policy for tool calls. It models a financial adviser with two
tools: `getClientRecord` is an unguarded read tool that returns the current
actor's financial record, and `sendEmail` is wrapped with `guardTool` so Arcjet
evaluates the model-selected recipient and body before the simulated email side
effect can run. Because the policy lives in the Arcjet dashboard, you can change
enforcement without redeploying the app.

> [!WARNING]
> This is a policy-matrix demo, not a production authentication pattern. The
> `/evaluate` and `/context` routes are unauthenticated so the page can drive
> the matrix. A hosted version must add authentication and/or rate limiting
> before calling the model, and must not return raw records or tool traces.
> JSON bodies are capped at 32 KiB.

> [!IMPORTANT]
> This example depends on the Arcjet Guard **remote policy** API
> (`policyInput`, `guardTool`'s `actor` option,
> `launchArcjet({ sensitiveInfoBackend })`, and `decision.policyResults`), which
> is **not yet published to npm**. The Arcjet packages are pinned to
> `1.10.0-rc.0` as the closest published release, but `npm ci` and the build
> will not succeed until the Guard policy API ships. Repin to the stable release
> once it is available.

## Features

- [Arcjet Guard remote policies](https://docs.arcjet.com/guards/remote-policies)
  let you configure and change the `email.sent` policy from the Arcjet
  dashboard, with no code changes or redeployment.
- [`guardTool`](https://docs.arcjet.com/guards/quick-start) wraps a Vercel AI
  SDK tool so Arcjet evaluates the model-selected arguments at the boundary
  before the tool's side effect runs.
- [Sensitive information detection](https://docs.arcjet.com/sensitive-info/quick-start)
  inspects the email body and denies leaks of account numbers and other
  entities, using the Rampart backend.
- [Prompt injection detection](https://docs.arcjet.com/prompt-injection)
  evaluates the untrusted inbound message as a layered backstop.

## Run locally

1. [Register for a free Arcjet account](https://app.arcjet.com).

2. Install dependencies:

```bash
npm ci
```

3. Rename `.env.local.example` to `.env.local` and add your Arcjet key
   (`ARCJET_KEY`) and a Vercel [AI Gateway](https://vercel.com/docs/ai-gateway)
   API key (`AI_GATEWAY_API_KEY`).

4. Configure the Guard policy in the Arcjet dashboard (see below).

5. Start the server:

```bash
npm run start
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

The example runs TypeScript directly using Node.js type stripping, so no build
step is required (Node.js 24+).

### Policy configuration

Create a Guard policy labelled `email.sent` (or set the `GUARD_POLICY_LABEL`
environment variable) with these inputs:

- `recipient`: server string
- `allowed_recipients`: server string list
- `body`: local string
- `incoming_message`: server string

Add these rules:

1. **Allowed-list membership** requiring `recipient` to be a member of
   `allowed_recipients`.
2. **Sensitive info** on `body`, allowing `EMAIL`, `GIVEN_NAME`, and `SURNAME`
   while denying every other detected entity type.
3. **Prompt injection** on `incoming_message`.

The example configures the Rampart sensitive-info backend. The structured demo
record uses public sandbox bank values that Rampart identifies as
`BANK_ACCOUNT` and `ROUTING_NUMBER`; the `SSN` recognizer provides an additional
deterministic backstop. The values come from the
[Worldpay](https://docs.worldpay.com/apis/payrix/dev-int-guide/initial-setup/testing/test-cards-and-accounts)
and [BILL](https://developer.bill.com/docs/sandbox-bank-account-setup) sandbox
documentation.

The current architecture evaluates prompt injection server-side, so the inbound
message is intentionally a server input. Actor, client record, and allowed
recipients remain server-owned.

### Demo sequence

The server — not the browser — maps each trusted actor/client ID to its
financial record and allowed recipients. The browser submits only the selected
client, scenario, and an allow-listed model ID; it cannot supply an actor,
record, or recipient allow-list.

Run each scenario for either client:

- **Benign request** sends a PII-free acknowledgement to the client's own
  allowed address.
- **Wrong recipient** is denied only by membership for Client A, while the same
  recipient is allowed for Client B.
- **Sensitive information leak** uses the client's allowed address, isolating
  the sensitive-info control when the model echoes account details.
- **Layered defense** contains an injected request for an external recipient
  and account-data exfiltration. When a model follows it, membership and
  sensitive-info provide deterministic backstops; prompt-injection detection
  may add another denial reason.

The layered-defense scenario also exposes a model selector. Start with
**GPT-4o mini**, which reliably demonstrates the injected external send reaching
the guarded tool. Then compare **GPT-5 mini** and the latest **GPT-5.6 Sol**:
newer models may ignore the injected destination or sanitize the body before
calling the tool. Model behavior is nondeterministic, which is the point of the
comparison; Arcjet remains the deterministic enforcement boundary whenever a
model attempts an unsafe action. Other scenarios use GPT-4o.

Keep all rules in **LIVE** for this matrix. Review each decision in the Console
to show the trusted actor and per-rule evidence, then change and publish the
policy to demonstrate enforcement without an application deployment.

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
