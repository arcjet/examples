import { detectProxy } from "./detect-proxy.js";
import { createFetchTransport } from "./transport-fetch.js";
import { createHttp2Transport } from "./transport-http2.js";
//#region src/transport-bun.ts
/**
* Create a Connect transport for the given base URL on Bun.
*
* Without a proxy it connects directly over HTTP/2, optimistically
* pre-connecting so the first `.guard()` call doesn't pay the full TCP + TLS
* setup cost. When a proxy is detected (`HTTP_PROXY`/`HTTPS_PROXY`, respecting
* `NO_PROXY`) it uses the fetch transport so Bun's native `fetch` performs the
* proxying.
*/
function createTransport(baseUrl) {
	if (detectProxy(new URL(baseUrl)) === void 0) return createHttp2Transport(baseUrl).transport;
	return createFetchTransport(baseUrl);
}
//#endregion
export { createTransport };
