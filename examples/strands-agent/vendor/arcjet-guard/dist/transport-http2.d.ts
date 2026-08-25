/**
 * Direct HTTP/2 transport factory shared by the `@arcjet/guard` Node and Bun
 * entry points.
 *
 * Both Node and Bun talk to the Arcjet API over HTTP/2 via
 * `@connectrpc/connect-node` (Bun implements `node:http2`, but its `fetch` does
 * not support HTTP/2 — {@link https://github.com/oven-sh/bun/issues/7194}). The
 * proxy strategy differs between the two runtimes, so each entry point handles
 * proxying itself and reuses this for the direct, no-proxy case.
 *
 * @packageDocumentation
 */
import type { Transport } from "@connectrpc/connect";
import { Http2SessionManager } from "@connectrpc/connect-node";
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
 * The session is pre-connected so the first `.guard()` call doesn't pay the
 * full TCP + TLS setup cost. PING keep-alive and deadline-based connection
 * recycling detect a silently dropped connection (an intermediary expiring an
 * idle flow without notifying either end) and replace it, instead of letting a
 * dead session fail every call until the process restarts.
 *
 * @param baseUrl Base URL for the Arcjet API.
 * @returns The transport and its session manager.
 */
export declare function createHttp2Transport(baseUrl: string): Http2TransportHandle;
