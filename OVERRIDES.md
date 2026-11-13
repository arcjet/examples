# npm overrides

This repository does not use npm workspaces. Each example is a standalone
project with its own `package.json`, and examples do not commit a lockfile, so
every install resolves the newest versions that the ranges allow. When a
parent package's own range still selects a transitive release with a Socket
or `npm audit` finding, raise the transitive package with an
[`overrides`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#overrides)
entry in **that example's** `package.json`. Use a caret range for the
override, like the example's other dependencies.

Do not run `npm audit fix` or `npm audit fix --force`. Prefer an explicit
override (or a parent-package bump) so the override is visible and reviewable.

Record every new override here: which example, which parent selects the
affected release, and what would let us delete it. To check whether an
override is still needed, delete it in a scratch copy of the example, run
`npm install --package-lock-only` and `npm audit`, and see whether the
parent now resolves a release outside the advisory's range.

## genkit-agent: `openai`

|          |                                                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Example  | [`examples/genkit-agent`](./examples/genkit-agent)                                                                                             |
| Override | `"openai": "^7.8.0"`                                                                                                                           |
| Parent   | `@genkit-ai/compat-oai@1.44.0` (`openai@^4.95.0`)                                                                                              |
| Trigger  | Socket **Block** on [PR #201](https://github.com/arcjet/examples/pull/201): `Potential vulnerability: npm openai` at `openai@4.104.0` (medium) |

The Genkit demo calls the [Vercel AI
Gateway](https://vercel.com/docs/ai-gateway) through Genkit's
OpenAI-compatible plugin. That plugin is the only published way to point
`genkit()` at an OpenAI-compatible `baseURL`.

`@genkit-ai/compat-oai@1.44.0` still declares `openai@^4.95.0`, which
resolves to `4.104.0` — the last 4.x release. There is no newer 4.x, and no
published GHSA/CVE for 4.104.0; this is Socket's own "potential
vulnerability" class. Bumping Genkit does not clear the alert.

The override forces `openai@7`. This example uses non-streaming
`ai.generate()`, which maps to `client.chat.completions.create` — still
present on 7.x. `APIError` remains a named export from `openai`.

**Do not enable Genkit streaming through `compat-oai` while this override is
in place.** `client.beta.chat.completions.stream` was removed in openai 5+;
streaming would throw at runtime.

**Remove this override when** `@genkit-ai/compat-oai` depends on `openai@5`
or later (or stops depending on the `openai` package).

## Security maintenance overrides

These overrides keep the APIs used by the examples while a parent's range
still selects an affected release. Remove each one once its parent accepts
the patched release.

| Example                  | Override                                                                                                | Parent and removal condition                                                                                                                                                    | Advisory                                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cloudflare-think-agent` | `guarded-fetch > undici: ^7.30.1`                                                                       | `guarded-fetch` 0.1.3 pins undici 7.29.0. Remove when it permits 7.30.1 or later.                                                                                               | [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c), [GHSA-4w7w-5xrc-9h26](https://github.com/advisories/GHSA-4w7w-5xrc-9h26), [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx) and others fixed in 7.30.1 |
| `eve-agent`              | `eve > undici: ^8.12.2`                                                                                 | `eve` 0.81.1 pins undici 8.10.2. Remove when it permits 8.12.2 or later.                                                                                                        | [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c), [GHSA-4w7w-5xrc-9h26](https://github.com/advisories/GHSA-4w7w-5xrc-9h26), [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx) and others fixed in 8.12.2 |
| `express-newman`         | `jose: ^5.6.3`                                                                                          | `postman-runtime` 7.39.1 pins jose 4.14.4. Remove when it permits 4.15.5 or later.                                                                                              | [GHSA-hhhv-q57g-882q](https://github.com/advisories/GHSA-hhhv-q57g-882q)                                                                                                                                                                                |
| `express-newman`         | `lodash: ^4.18.1`                                                                                       | `newman` 6.2.3 and the Postman packages pin lodash 4.17.21. Remove when they permit 4.18.0 or later.                                                                            | [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc), [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg)                                                                                                      |
| `express-newman`         | `node-forge: >1.3.2`                                                                                    | `postman-runtime` 7.39.1 pins node-forge 1.3.1. Remove when it permits 1.4.3 or later.                                                                                          | [GHSA-554w-wpv2-vw27](https://github.com/advisories/GHSA-554w-wpv2-vw27), [GHSA-5gfm-wpxj-wjgq](https://github.com/advisories/GHSA-5gfm-wpxj-wjgq) and others up to 1.4.2                                                                               |
| `express-newman`         | `qs: ^6.14.1`                                                                                           | `postman-request` allows only `~6.14.1` and `~6.5.3`. Remove when it permits 6.16.1 or later.                                                                                   | [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw)                            |
| `express-newman`         | `flatted: >=3.4.2`                                                                                      | `uvm` 2.1.1 pins flatted 3.2.6. Remove when it permits 3.4.2 or later.                                                                                                          | [GHSA-25h7-pfq9-p65f](https://github.com/advisories/GHSA-25h7-pfq9-p65f), [GHSA-rf6f-7fwh-wjgh](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh)                                                                                                      |
| `express-newman`         | `handlebars: ^4.7.10`                                                                                   | `postman-runtime` 7.39.1 pins handlebars 4.7.8. Remove when it permits 4.7.10 or later.                                                                                         | [GHSA-2w6w-674q-4c4q](https://github.com/advisories/GHSA-2w6w-674q-4c4q), [GHSA-8r5x-fm3f-whwj](https://github.com/advisories/GHSA-8r5x-fm3f-whwj), [GHSA-p8wg-vrv2-v86f](https://github.com/advisories/GHSA-p8wg-vrv2-v86f) and others                 |
| `express-newman`         | `underscore: >=1.13.8`                                                                                  | `httpntlm` 1.8.13 allows only `~1.12.1`. Remove when it permits 1.13.8 or later.                                                                                                | [GHSA-qpx9-hpmf-5gmw](https://github.com/advisories/GHSA-qpx9-hpmf-5gmw)                                                                                                                                                                                |
| `express-newman`         | `uuid: ^11.1.1` under `postman-collection`, `postman-request`, `postman-runtime` and `serialised-error` | These packages pin uuid 3.x or 8.x. Remove when they permit 11.1.1 or later.                                                                                                    | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)                                                                                                                                                                                |
| `firebase-functions`     | `uuid: ^11.1.1` under `gaxios`, `google-gax` and `teeny-request`                                        | These Google clients allow only uuid 9.x. Remove when they permit 11.1.1 or later.                                                                                              | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)                                                                                                                                                                                |
| `firebase-functions`     | `@google-cloud/pubsub > @opentelemetry/core: ^2.11.0`                                                   | Pub/Sub 5.3.1 allows only core 1.x but uses the compatible W3CTraceContextPropagator API. Remove when it permits 2.8.0 or later.                                                | [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf)                                                                                                                                                                                |
| `genkit-agent`           | `uuid: ^11.1.1`                                                                                         | Genkit and its Google clients allow only uuid 9.x or 10.x. The APIs used here remain available in 11.x. Remove when all parents permit 11.1.1 or later.                         | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)                                                                                                                                                                                |
| `genkit-agent`           | `@opentelemetry/sdk-trace-node > @opentelemetry/propagator-jaeger: ^2.9.0`                              | SDK trace-node 1.25.1 pins Jaeger 1.25.1. Its constructor and API 1.x peer remain compatible with 2.9.0. Remove when it permits 2.9.0 or later.                                 | [GHSA-45rx-2jwx-cxfr](https://github.com/advisories/GHSA-45rx-2jwx-cxfr)                                                                                                                                                                                |
| `google-adk-agent`       | `uuid: ^11.1.1`                                                                                         | Google ADK brings uuid 9.x through gaxios. Remove when gaxios permits 11.1.1 or later.                                                                                          | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)                                                                                                                                                                                |
| `nextjs-ai-agent`        | `undici: ^7.30.1` under `@workflow/world-local` and `@workflow/world-vercel`                            | Both world adapters pin undici 7.30.0. Remove when both permit 7.30.1 or later.                                                                                                 | [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c), [GHSA-4w7w-5xrc-9h26](https://github.com/advisories/GHSA-4w7w-5xrc-9h26), [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx) and others fixed in 7.30.1 |
| `nextjs-ai-agent`        | `devalue: ^5.9.3`                                                                                       | `@workflow/core` 4.8.16 pins devalue 5.9.2. Remove when it permits 5.9.3 or later.                                                                                              | [GHSA-j22f-vq7h-c4qm](https://github.com/advisories/GHSA-j22f-vq7h-c4qm), [GHSA-mcm9-63f2-9j32](https://github.com/advisories/GHSA-mcm9-63f2-9j32), [GHSA-x5rw-q4pp-hg5g](https://github.com/advisories/GHSA-x5rw-q4pp-hg5g) and others                 |
| `nextjs-ai-agent`        | `zod: $zod`                                                                                             | Resolves every zod in the tree to the example's own zod range. `@vercel/cli-auth` pins 4.1.11 and `@workflow/cli` allows only `~4.3.6`. Remove when both permit 4.6.6 or later. | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)                                                                                                                                                                                |
| `sveltekit`              | `@sveltejs/kit > cookie: ^0.7.0`                                                                        | SvelteKit 2.70.4 allows only cookie `^0.6.0`. Remove when it permits 0.7.0 or later.                                                                                            | [GHSA-pxg6-pf52-xh8x](https://github.com/advisories/GHSA-pxg6-pf52-xh8x)                                                                                                                                                                                |
