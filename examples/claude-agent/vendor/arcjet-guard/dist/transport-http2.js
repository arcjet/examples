import { withConnectionRecycling } from "./transport-recycle.js";
import { Http2SessionManager, createConnectTransport } from "@connectrpc/connect-node";
//#region src/transport-http2.ts
/**
* Create a direct HTTP/2 Connect transport, optimistically pre-connecting.
*
* The session is pre-connected so the first `.guard()` call doesn't pay the
* full TCP + TLS setup cost. PING keep-alive and deadline-based connection
* recycling detect a silently dropped connection (an intermediary expiring an
* idle flow without notifying either end) and replace it, instead of letting a
* dead session fail every call until the process restarts.
*
* @param baseUrl Base URL for the Arcjet API.
* @returns The transport and its session manager.
*/
function createHttp2Transport(baseUrl) {
	const sessionManager = new Http2SessionManager(baseUrl, {
		pingIntervalMs: 55 * 1e3,
		pingTimeoutMs: 5 * 1e3,
		pingIdleConnection: true,
		idleConnectionTimeoutMs: 340 * 1e3
	});
	sessionManager.connect().catch(() => {});
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
