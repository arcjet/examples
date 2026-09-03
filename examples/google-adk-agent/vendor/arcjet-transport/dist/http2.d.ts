import { Transport } from "@connectrpc/connect";
import { Http2SessionManager } from "@connectrpc/connect-node";
import { ClientSessionOptions, SecureClientSessionOptions } from "node:http2";
//#region src/http2.d.ts
/**
 * Optional `http2.connect` session options forwarded to `Http2SessionManager`.
 *
 * Used by the Node proxy path to tunnel HTTP/2 through `CONNECT` via
 * `createConnection`.
 */
type Http2ConnectOptions = ClientSessionOptions | SecureClientSessionOptions;
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
declare function createHttp2Transport(baseUrl: string, http2SessionOptions?: Http2ConnectOptions): Http2TransportHandle;
//#endregion
export { Http2ConnectOptions, Http2TransportHandle, createHttp2Transport };