<!-- markdownlint-disable MD033 MD041 -->
<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

# Arcjet example: Next.js sensitive information detection

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This example demonstrates Arcjet sensitive information detection in a Next.js
app using three [route
handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers):
a `sensitiveInfo` rule with a custom detection function, the on-device Rampart
NER backend, and Arcjet Guard. All detection runs on-device — no request
content leaves your environment.

## Features

- [Sensitive information
  detection](https://docs.arcjet.com/sensitive-info/concepts) blocks requests
  that contain PII you do not want to handle. The `/api/arcjet` route adds a
  [custom detection
  function](https://docs.arcjet.com/sensitive-info/reference#custom-detect)
  (`CONTAINS_DASH`, with a `contextWindowSize`) alongside the built-in types.
- [Shield](https://docs.arcjet.com/shield/concepts) protects against common
  attacks such as SQL injection and cross-site scripting.
- [On-device Rampart NER
  backend](https://docs.arcjet.com/sensitive-info/reference) — the
  `/api/arcjet-rampart` route swaps the default WebAssembly engine for the
  [`@arcjet/sensitive-info-rampart`](https://www.npmjs.com/package/@arcjet/sensitive-info-rampart)
  backend, which detects names, addresses, and government/financial identifiers
  on-device.
- [Arcjet Guard](https://docs.arcjet.com/guard/concepts) — the
  `/api/arcjet-guard` route uses
  [`@arcjet/guard`](https://www.npmjs.com/package/@arcjet/guard)
  (`launchArcjet` / `localDetectSensitiveInfo`) for AI guardrails. Detection
  runs locally and only a SHA-256 hash of the text is sent to Arcjet.

## Run locally

1. [Register for a free Arcjet account](https://console.arcjet.com).

2. Install dependencies:

   ```bash
   npm ci
   ```

   > This example depends on `@arcjet/sensitive-info-rampart`, which pulls in a
   > native ONNX runtime (`@huggingface/transformers` / `onnxruntime-node`).
   > The install downloads a native binary, so it is larger and slower than a
   > typical example.

3. Rename `.env.local.example` to `.env.local` and add your Arcjet key. Keep
   `ARCJET_ENV=development` set when testing locally with `curl` so Arcjet
   doesn't require a public client IP for the request fingerprint.

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser, then
   exercise the routes with `curl`:

   ```bash
   # Custom detection (CONTAINS_DASH) + Shield
   curl http://localhost:3000/api/arcjet \
     -H "Content-Type: text/plain" \
     -X POST --data "here's a string that contains-a-dash"

   # On-device Rampart NER backend
   curl http://localhost:3000/api/arcjet-rampart \
     -H "Content-Type: text/plain" \
     -X POST --data "Hi, my name is Alex Rivera and my SSN is 472-81-0094"

   # Arcjet Guard (only a SHA-256 hash is sent to Arcjet)
   curl http://localhost:3000/api/arcjet-guard \
     -H "Content-Type: text/plain" \
     -X POST --data "Hi, my name is Alex Rivera and my SSN is 472-81-0094"
   ```

   If the data you send contains a blocked type the route returns a `400`.

## Configuring Next.js for the Rampart backend

The Rampart backend loads a native ONNX runtime
(`@huggingface/transformers` / `onnxruntime-node`) and reads its bundled model
weights from disk at runtime. If Next.js tries to bundle these into the server
build, the native binary and the model files won't resolve. They are marked as
[server external
packages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)
in `next.config.mjs` so Next.js loads them from `node_modules` at runtime
instead:

```js
// next.config.mjs
const nextConfig = {
  serverExternalPackages: [
    "@arcjet/sensitive-info-rampart",
    "@huggingface/transformers",
    "onnxruntime-node",
  ],
};
```

Any route handler that uses the backend must also run on the Node.js runtime
(the default for route handlers) rather than the Edge runtime, since the native
addon is not available on Edge:

```ts
// app/api/arcjet-rampart/route.ts
export const runtime = "nodejs";
```

The model is loaded once on the first request (a few hundred milliseconds) and
reused after that.

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
