import { detectProxy } from "./detect-proxy.js";
import { createHttp2Transport } from "./http2.js";
import { createTunnelingConnection } from "./proxy-tunnel.js";
import { createConnectTransport } from "@connectrpc/connect-node";
import * as http from "node:http";
import * as https from "node:https";
//#region src/index.ts
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
function createTransport(baseUrl, options) {
	const url = new URL(baseUrl);
	const proxyUrl = detectProxy(url, options);
	if (typeof proxyUrl === "string") {
		if (options?.proxyHttpVersion === "2") return createHttp2Transport(baseUrl, { createConnection: createTunnelingConnection(proxyUrl) }).transport;
		const isHttps = url.protocol === "https:";
		const agentOptions = {
			keepAlive: true,
			proxyEnv: isHttps ? { HTTPS_PROXY: proxyUrl } : { HTTP_PROXY: proxyUrl }
		};
		const agent = isHttps ? new https.Agent(agentOptions) : new http.Agent(agentOptions);
		return createConnectTransport({
			baseUrl,
			httpVersion: "1.1",
			nodeOptions: { agent }
		});
	}
	return createHttp2Transport(baseUrl).transport;
}
//#endregion
export { createTransport };
