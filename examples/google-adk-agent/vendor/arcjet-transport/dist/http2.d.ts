/**
 * Direct HTTP/2 Connect transport factory shared by `@arcjet/transport` and
 * `@arcjet/guard`.
 *
 * Exported as `@arcjet/transport/http2` so callers that need Node's
 * `connect-node` HTTP/2 path unconditionally (notably `@arcjet/guard` on Bun,
 * where the package's `"bun"` condition resolves to fetch/HTTP/1.1) can import
 * it without hitting a runtime-conditioned entry point.
 *
 * Bun implements `node:http2` but its `fetch` does not support HTTP/2
 * ({@link https://github.com/oven-sh/bun/issues/7194}), which is why Guard
 * keeps a separate Bun entry for proxying while still using this factory for
 * the direct path.
 */
import type { ClientSessionOptions, SecureClientSessionOptions } from "node:http2";
import type { Transport } from "@connectrpc/connect";
import { Http2SessionManager } from "@connectrpc/connect-node";
/**
 * Optional `http2.connect` session options forwarded to `Http2SessionManager`.
 *
 * Used by the Node proxy path to tunnel HTTP/2 through `CONNECT` via
 * `createConnection`.
 */
export type Http2ConnectOptions = ClientSessionOptions | SecureClientSessionOptions;
/**
 * A direct HTTP/2 transport plus the session manager that owns its connection.
 *
 * The session manager is exposed so callers (and tests) can tear the
 * connection down deterministically.
 */
export interface Http2TransportHandle {
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
export declare function createHttp2Transport(baseUrl: string, http2SessionOptions?: Http2ConnectOptions): Http2TransportHandle;
