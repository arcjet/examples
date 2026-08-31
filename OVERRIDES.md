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
