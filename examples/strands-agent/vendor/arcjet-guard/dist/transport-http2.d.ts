import { Transport } from "@connectrpc/connect";
import { Http2SessionManager } from "@connectrpc/connect-node";
//#region src/transport-http2.d.ts
/**
 * A direct HTTP/2 transport plus the session manager that owns its connection.
 *
 * The session manager is exposed so callers (and tests) can tear the
 * connection down deterministically.
 */
interface Http2TransportHandle {
  transport: Transport;
  sessionManager: Http2SessionManager;
}
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
declare function createHttp2Transport(baseUrl: string): Http2TransportHandle;
//#endregion
export { Http2TransportHandle, createHttp2Transport };