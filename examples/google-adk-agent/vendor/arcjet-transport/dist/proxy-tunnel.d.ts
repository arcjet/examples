import type { SecureClientSessionOptions } from "node:http2";
import { Duplex } from "node:stream";
/**
 * Route an HTTP/2 session through a forward proxy using an HTTP `CONNECT`
 * tunnel, preserving HTTP/2 to the origin.
 *
 * Node's built-in HTTP agent proxy support (and the `https-proxy-agent` family)
 * only wire a proxy into the HTTP/1.1 agent, which is why proxying otherwise
 * forces a downgrade from HTTP/2. But HTTP/2 survives a `CONNECT` tunnel
 * end-to-end: the proxy is told to open a raw TCP tunnel and thereafter only
 * blindly forwards bytes (RFC 9110 §9.3.6), so the TLS handshake — including the
 * ALPN negotiation that selects `h2` — happens directly with the origin. The
 * proxy never sees, and so cannot downgrade, the negotiated protocol.
 *
 * The one wrinkle is that {@linkcode http2.connect}'s `createConnection`
 * callback must return a {@linkcode Duplex} synchronously, but the `CONNECT`
 * handshake is asynchronous. We bridge that gap with a small `Duplex` that
 * buffers whatever the consumer writes (the TLS `ClientHello`, or the HTTP/2
 * client preface for a cleartext target) until the proxy answers `2xx`, then
 * splices itself onto the proxy socket. Because the contract stays synchronous,
 * this drops into `@connectrpc/connect-node`'s default `Http2SessionManager`
 * via `nodeOptions.createConnection` with no fork — reconnection, pings, and the
 * idle timeout all keep working.
 *
 * This is Node-only. Bun and Deno don't implement the agent option this sits
 * alongside, and their `fetch` is used for proxying instead.
 *
 * @param proxyUrl
 *   Proxy to route through (for example `http://127.0.0.1:3128`). An HTTPS proxy
 *   (TLS to the proxy itself) is supported too.
 * @returns
 *   A `createConnection` callback for `http2.connect(..., { createConnection })`
 *   (and therefore for connect-node's `nodeOptions.createConnection`).
 */
export declare function createTunnelingConnection(proxyUrl: string): (authority: URL, options: SecureClientSessionOptions) => Duplex;
