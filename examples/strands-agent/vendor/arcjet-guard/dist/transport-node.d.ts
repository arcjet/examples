/**
 * Connect RPC transport factory for `@arcjet/guard` — Node.js.
 *
 * Without a proxy it connects directly over HTTP/2. When a standard proxy
 * environment variable is detected, it routes through the proxy over HTTP/1.1
 * using the built-in proxy support of the Node.js HTTP agent.
 *
 * This entry point is Node-only: Bun has its own entry point
 * (`transport-bun.ts`) because its `fetch` proxies but its `node:http` agent
 * does not, and Deno reaches the fetch entry point through the `"deno"` export
 * condition. An explicit `@arcjet/guard/node` import on Bun or Deno still lands
 * here and uses the Node agent — whose `proxyEnv` option those runtimes don't
 * implement, so a proxy would not be applied on them (use the default import
 * for proxy support there).
 *
 * @packageDocumentation
 */
import type { Transport } from "@connectrpc/connect";
/**
 * Create a Connect transport for the given base URL.
 *
 * When a proxy is detected (`HTTP_PROXY`/`HTTPS_PROXY`, respecting `NO_PROXY`),
 * the request is routed through it over HTTP/1.1 using the built-in proxy
 * support of the Node.js HTTP agent. Without a proxy it connects directly over
 * HTTP/2, optimistically pre-connecting so the first `.guard()` call doesn't
 * pay the full TCP + TLS setup cost.
 */
export declare function createTransport(baseUrl: string): Transport;
