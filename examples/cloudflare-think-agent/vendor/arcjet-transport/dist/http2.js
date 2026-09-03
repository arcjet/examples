import { withConnectionRecycling } from "./connection-recycle.js";
import { Http2SessionManager, createConnectTransport } from "@connectrpc/connect-node";
//#region src/http2.ts
/**
* Create a direct HTTP/2 Connect transport, optimistically pre-connecting.
*
* The session is pre-connected so the first RPC doesn't pay the full TCP + TLS
* setup cost (skipped under Deno's Node HTTP/2 compatibility layer, which can
* surface background session failures as uncaught test errors). PING keep-alive
* and deadline-based connection recycling detect a silently dropped connection
* (an intermediary expiring an idle flow without notifying either end) and
* replace it, instead of letting a dead session fail every call until the
* process restarts — or, on serverless, leaving a GOAWAY from a peer-closed
* idle connection as an uncaught exception on a frozen instance.
*
* @param baseUrl Base URL for the Arcjet API.
* @param http2SessionOptions Optional options passed to `http2.connect`
*   (for example a `createConnection` tunnel).
* @returns The transport and its session manager.
*/
function createHttp2Transport(baseUrl, http2SessionOptions) {
	const sessionManager = new Http2SessionManager(baseUrl, {
		pingIntervalMs: 55e3,
		pingTimeoutMs: 5e3,
		pingIdleConnection: true,
		idleConnectionTimeoutMs: 34e4
	}, http2SessionOptions);
	if (!("Deno" in globalThis)) sessionManager.connect().catch(() => {});
	return {
		transport: withConnectionRecycling(createConnectTransport({
			baseUrl,
			httpVersion: "2",
			sessionManager
		}), sessionManager),
		sessionManager
	};
}
//#endregion
export { createHttp2Transport };
