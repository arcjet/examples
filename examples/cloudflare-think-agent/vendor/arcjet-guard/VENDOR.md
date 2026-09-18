# Vendored `@arcjet/guard`

Unpublished Cloudflare Think adapter pin.

- **Source:** [arcjet/arcjet-js](https://github.com/arcjet/arcjet-js) `arcjet-guard`
- **Branch:** `david/cursor/cloudflare-think-guard-v0-26f2`
- **SHA:** `b06e584d491d4821f81c9e3083ed8f0c8da15ba7`
- **Adapter:** `@arcjet/guard/cloudflare-think/v0`
- **Built version stamp:** `1.13.0-vendor.b06e584`

Published `@arcjet/guard@1.13.0` does not export `./cloudflare-think/v0`.
This directory is the `tsdown` build of that SHA (`dist/`, `skills/`,
`package.json`, `LICENSE`). Runtime deps (`@arcjet/analyze`,
`@arcjet/logger`, `@arcjet/transport` at 1.13.0) stay on npm.

`package.json` `peerDependencies` is trimmed to `@cloudflare/think`
(`>=0.3.0 <1`) and `devDependencies` are omitted so `file:` install
does not pull unused Guard adapter SDKs.
