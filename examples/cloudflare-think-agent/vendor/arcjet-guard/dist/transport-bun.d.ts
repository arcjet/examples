import { Transport } from "@connectrpc/connect";
//#region src/transport-bun.d.ts
/**
 * Create a Connect transport for the given base URL on Bun.
 *
 * Without a proxy it connects directly over HTTP/2, optimistically
 * pre-connecting so the first `.guard()` call doesn't pay the full TCP + TLS
 * setup cost. When a proxy is detected (`HTTP_PROXY`/`HTTPS_PROXY`, respecting
 * `NO_PROXY`) it uses the fetch transport so Bun's native `fetch` performs the
 * proxying.
 */
declare function createTransport(baseUrl: string): Transport;
//#endregion
export { createTransport };