import { Transport } from "@connectrpc/connect";
//#region src/transport-node.d.ts
/**
 * Create a Connect transport for the given base URL.
 *
 * When a proxy is detected (`HTTP_PROXY`/`HTTPS_PROXY`, respecting `NO_PROXY`),
 * the request is routed through it over HTTP/1.1 using the built-in proxy
 * support of the Node.js HTTP agent. Without a proxy it connects directly over
 * HTTP/2, optimistically pre-connecting so the first `.guard()` call doesn't
 * pay the full TCP + TLS setup cost.
 */
declare function createTransport(baseUrl: string): Transport;
//#endregion
export { createTransport };