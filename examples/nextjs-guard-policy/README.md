<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

# Arcjet example: Next.js Guard policy

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This is an example Next.js application demonstrating a remotely-configured
[Arcjet Guard](https://docs.arcjet.com/guard/concepts) policy applied to Vercel
AI SDK tool calls. A financial-adviser agent has a guarded `sendEmail` tool that
Arcjet evaluates against a remote `email.sent` policy before the simulated email
side effect can run. The policy combines string-list membership (allowed
recipients), sensitive-info detection (Rampart backend), and prompt-injection
detection.

> [!WARNING]
> This is a policy-matrix demo, not a production authentication pattern. The
> selected client is an untrusted fixture selector, not an authenticated
> identity. Production code must derive `actor` from an authenticated
> server-side session, and any hosted version must add authentication and/or
> rate limiting before calling the model. The context endpoint and tool trace
> intentionally expose their raw values to make policy evaluation visible;
> production APIs must instead return display-safe data and redact or omit tool
> inputs, tool results, prompts, and sensitive values. All people, records, and
> identifiers in this example are synthetic demo fixtures.

> [!IMPORTANT]
> This example depends on the Arcjet Guard **remote policy** API
> (`policyInput`, `guardTool`'s `actor` option,
> `launchArcjet({ sensitiveInfoBackend })`, and `decision.policyResults`), which
> is **not yet published to npm**. The Arcjet packages are pinned to
> `1.10.0-rc.0` as the closest published release, but `npm ci` and the build
> will not succeed until the Guard policy API ships. Repin to the stable release
> once it is available.

## Features

- [Arcjet Guard](https://docs.arcjet.com/guard/concepts) evaluates a
  remotely-configured policy so you can change enforcement without redeploying
  the application.
- [Guarding AI SDK tool calls](https://docs.arcjet.com/guard/vercel-ai) wraps a
  Vercel AI SDK tool with `guardTool` so the model-selected inputs are evaluated
  at the boundary before the tool's side effect runs.
- [Sensitive information
  detection](https://docs.arcjet.com/sensitive-info/concepts) uses the Rampart
  backend to detect PII such as bank accounts and routing numbers in the email
  body.
- [Prompt injection
  detection](https://docs.arcjet.com/redact/concepts) analyzes the inbound
  customer message for injection attacks.

## Run locally

1. [Register for a free Arcjet account](https://app.arcjet.com).

2. Install dependencies:

```bash
npm ci
```

3. Rename `.env.local.example` to `.env.local` and set:

   - `ARCJET_KEY` — your Arcjet site key from
     [the Arcjet dashboard](https://app.arcjet.com).
   - `AI_GATEWAY_API_KEY` — a [Vercel AI
     Gateway](https://vercel.com/docs/ai-gateway) API key used to call the
     model.
   - `GUARD_POLICY_LABEL` — optional; defaults to `email.sent`. Set it if you
     labelled your dashboard policy differently.

4. Configure the Guard policy in the Arcjet dashboard (see
   [Setup](#setup-configure-the-guard-policy) below).

5. Start the dev server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Setup: configure the Guard policy

This example evaluates a remote Guard policy that you configure in the
[Arcjet dashboard](https://app.arcjet.com). No policy rules are defined in code,
so you can change and publish the policy to demonstrate enforcement without an
application deployment.

Create a Guard policy labelled `email.sent` (or set `GUARD_POLICY_LABEL` to your
chosen label) with these inputs:

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

The `policyInput.server.*` inputs (`recipient`, `allowed_recipients`,
`incoming_message`) are owned by the server and cannot be supplied by the
browser. Only `body` is a `policyInput.local.*` value derived from the model's
tool call. The current architecture evaluates prompt injection server-side, so
the inbound message is intentionally a server input.

Keep all rules in **LIVE** mode for this matrix. Review each decision in the
Arcjet Console to show the trusted actor and per-rule evidence.

## Demo sequence

The server — not the browser — maps each trusted actor/client ID to its
financial record and allowed recipients. The browser submits the selected
client, scenario, and an allow-listed model ID; it cannot supply an actor,
record, or recipient allow-list. Run each scenario for either client:

- **Benign request** sends a PII-free acknowledgement to the client's own
  allowed address.
- **Wrong recipient** is denied only by membership for Client A, while the same
  recipient is allowed for Client B.
- **Sensitive information leak** uses the client's allowed address, isolating
  the sensitive-info control when the model echoes account details.
- **Layered defense** contains an injected request for an external recipient
  and account-data exfiltration. When a model follows it, membership and
  sensitive-info provide deterministic backstops; prompt-injection detection may
  add another denial reason.

The layered-defense scenario also exposes a model selector. Start with
**GPT-4o mini**, which reliably demonstrates the injected external send reaching
the guarded tool. Then compare newer models, which may ignore the injected
destination or sanitize the body before calling the tool. Model behavior is
nondeterministic, which is the point of the comparison; Arcjet remains the
deterministic enforcement boundary whenever a model attempts an unsafe action.
Other scenarios use GPT-4o.

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
