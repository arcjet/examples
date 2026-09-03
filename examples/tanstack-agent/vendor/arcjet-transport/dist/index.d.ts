import type { Transport } from "@connectrpc/connect";
export type { ProxyEnvironment, TransportLogger, TransportOptions } from "./detect-proxy.js";
import type { TransportOptions } from "./detect-proxy.js";
/**
 * Create a transport that talks to the Arcjet API using Connect RPC.
 *
 * A thin wrapper around {@linkcode createConnectTransport}.
 *
 * When a standard proxy environment variable (`HTTP_PROXY` or `HTTPS_PROXY`,
 * respecting `NO_PROXY`) is detected, the transport routes requests through the
 * proxy and logs a line at startup. By default it proxies over HTTP/1.1 using
 * the built-in proxy support of the Node.js HTTP agent; set
 * `options.proxyHttpVersion` to `"2"` to instead tunnel HTTP/2 to the origin
 * via `CONNECT` (see {@linkcode TransportOptions.proxyHttpVersion}). Without a
 * proxy it always connects directly over HTTP/2.
 *
 * @param baseUrl
 *   Base URI for all HTTP requests (example: `https://example.com/my-api`).
 * @param options
 *   Configuration (optional).
 * @returns
 *   Connect transport used to make RPC calls.
 */
export declare function createTransport(baseUrl: string, options?: TransportOptions): Transport;
