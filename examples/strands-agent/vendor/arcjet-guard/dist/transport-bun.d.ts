/**
 * Connect RPC transport factory for `@arcjet/guard` — Bun.
 *
 * Bun resolves the `"."` export to this entry point. Without a proxy it
 * connects directly over HTTP/2 via `node:http2` (Bun's `fetch` doesn't support
 * HTTP/2 — {@link https://github.com/oven-sh/bun/issues/7194}). When a proxy is
 * detected it uses the fetch transport instead, because Bun's native `fetch`
 * honors the standard proxy environment variables while its `node:http` agent
 * ignores the `proxyEnv` option the Node entry point relies on.
 *
 * @packageDocumentation
 */
import type { Transport } from "@connectrpc/connect";
/**
 * Create a Connect transport for the given base URL on Bun.
 *
 * Without a proxy it connects directly over HTTP/2, optimistically
 * pre-connecting so the first `.guard()` call doesn't pay the full TCP + TLS
 * setup cost. When a proxy is detected (`HTTP_PROXY`/`HTTPS_PROXY`, respecting
 * `NO_PROXY`) it uses the fetch transport so Bun's native `fetch` performs the
 * proxying.
 */
export declare function createTransport(baseUrl: string): Transport;
