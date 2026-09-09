# npm overrides

This repository does not use npm workspaces. Each example is a standalone
project with its own `package.json` and `package-lock.json`. When a direct
dependency cannot be updated far enough to clear a Socket or `npm audit`
finding, pin the transitive package with an
[`overrides`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#overrides)
entry in **that example's** `package.json`, then run `npm install` in the
example directory.

Do not run `npm audit fix` or `npm audit fix --force`. Prefer an explicit
override (or a parent-package bump) so the pin is visible and reviewable.

Record every new override here: which example, which parent is stuck, why
the pin exists, and what would let us delete it.

## genkit-agent: `openai`

| | |
| --- | --- |
| Example | [`examples/genkit-agent`](./examples/genkit-agent) |
| Override | `"openai": "7.8.0"` |
| Parent | `@genkit-ai/compat-oai@1.41.0` (`openai@^4.95.0`) |
| Trigger | Socket **Block** on [PR #201](https://github.com/arcjet/examples/pull/201): `Potential vulnerability: npm openai` at `openai@4.104.0` (medium) |

The Genkit demo calls the [Vercel AI
Gateway](https://vercel.com/docs/ai-gateway) through Genkit's
OpenAI-compatible plugin. That plugin is the only published way to point
`genkit()` at an OpenAI-compatible `baseURL`.

`genkit` and `@genkit-ai/compat-oai` were already at latest (`1.41.0`) when
Socket blocked the PR. Both still declare `openai@^4.95.0`, which resolves
to `4.104.0` — the last 4.x release. There is no newer 4.x, and no published
GHSA/CVE for 4.104.0; this is Socket's own "potential vulnerability" class.
Even `@genkit-ai/compat-oai@1.42.0-rc.1` on genkit `main` keeps the 4.x pin,
so bumping Genkit does not clear the alert.

The override forces `openai@7.8.0`. This example uses non-streaming
`ai.generate()`, which maps to `client.chat.completions.create` — still
present on 7.x. `APIError` remains a named export from `openai`.

**Do not enable Genkit streaming through `compat-oai` while this override is
in place.** `client.beta.chat.completions.stream` was removed in openai 5+;
streaming would throw at runtime.

**Remove this override when** `@genkit-ai/compat-oai` depends on `openai@5`
or later (or stops depending on the `openai` package). Then delete the
`overrides` key, run `npm install` in `examples/genkit-agent`, and confirm
Socket no longer flags `openai@4.104.0`.

Other Socket **Block** rows on that PR were AI "code anomaly" signals on
Genkit's own telemetry stack (`@genkit-ai/core`, Firebase, OpenTelemetry,
zod, and similar). Those come with `genkit` and are not addressed by this
override.

## Other examples

Several other examples already pin transitives the same way (for example
`postcss` in the Next.js apps, `uuid` in `firebase-functions`). Those pins
live in the example `package.json`. Add a section above when you introduce
a new override that needs an explanation.

## Security maintenance overrides

These pins preserve the APIs used by the examples while upstream dependency
constraints still select affected versions. Remove each pin once its parent
accepts the patched release.

| Example | Override | Reason and removal condition | Advisory |
| --- | --- | --- | --- |
| `firebase-functions` | `qs: 6.16.0` | Express/body-parser pins keep an affected qs 6 release. Remove once their resolved qs is 6.16.0 or later. | [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) |
| `genkit-agent` | `qs: 6.16.0` | Express/body-parser pins keep an affected qs 6 release. Remove once their resolved qs is 6.16.0 or later. | [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) |
| `react-router` | `qs: 6.16.0` | Express/body-parser pins keep an affected qs 6 release. Remove once their resolved qs is 6.16.0 or later. | [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) |
| `react-router-middleware` | `qs: 6.16.0` | Express/body-parser pins keep an affected qs 6 release. Remove once their resolved qs is 6.16.0 or later. | [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) |
| `nextjs-ai-agent` | `nanoid: 5.1.16` | Workflow 4.8.3 pins nanoid 5.1.6. Remove when Workflow permits nanoid 5.1.16 or later. | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) |
| `nextjs-ai-agent` | `undici: 7.29.0` | Workflow world adapters pin undici 7.28.0. Remove when both permit undici 7.29.0 or later. | [GHSA-4cwx-7wf7-3272](https://github.com/advisories/GHSA-4cwx-7wf7-3272), [GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524), [GHSA-jr45-8vmc-qm54](https://github.com/advisories/GHSA-jr45-8vmc-qm54), [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5), [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm) |
| `google-adk-agent` | `@opentelemetry/core: 2.11.0` | Google ADK 2.0.0 exporter packages pin OpenTelemetry core 2.1.0. Remove when all resolved core versions are 2.8.0 or later. | [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) |
| `google-adk-agent` | `uuid: 11.1.1` | Google ADK brings an affected uuid through gaxios. Remove when its resolved uuid is 11.1.1 or later. | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |
