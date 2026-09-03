/**
 * Map of environment variables used to detect an outbound proxy.
 *
 * This is the same shape as `process.env`.
 */
export type ProxyEnvironment = Record<string, string | undefined>;
/**
 * Minimal logger used to print a line when a proxy is detected.
 */
export interface TransportLogger {
    /**
     * Log an informational message.
     *
     * @param message
     *   Template.
     * @param interpolationValues
     *   Parameters to interpolate.
     * @returns
     *   Nothing.
     */
    info(message: string, ...interpolationValues: unknown[]): void;
}
/**
 * Configuration shared by all transports.
 */
export interface TransportOptions {
    /**
     * Logger used to print a line at startup when a proxy is detected (optional).
     *
     * Defaults to a logger configured from the `ARCJET_LOG_LEVEL` environment
     * variable.
     */
    log?: TransportLogger | undefined;
    /**
     * Environment variables used to detect an outbound proxy (optional).
     *
     * Defaults to `process.env` so standard proxy environment variables
     * (`HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY`) are auto-detected. Pass
     * `false` to ignore proxy environment variables entirely.
     */
    proxyEnv?: ProxyEnvironment | false | undefined;
    /**
     * HTTP version to use when a proxy is in use, on Node.js (optional).
     *
     * Has no effect when no proxy applies, and no effect on Bun, Deno, or the
     * edge runtimes (which proxy through their `fetch` instead). Ignored for
     * direct connections, which always use HTTP/2.
     *
     * - `"1.1"` (default) routes through the proxy over HTTP/1.1 using the
     *   built-in proxy support of the Node.js HTTP agent. This works with any
     *   proxy the agent supports, but loses the latency benefits of HTTP/2.
     * - `"2"` establishes an HTTP `CONNECT` tunnel and keeps HTTP/2 to the origin
     *   end-to-end. This requires a tunneling (`CONNECT`) proxy — the common kind
     *   for HTTPS egress — and a proxy that does not buffer the tunnel (see the
     *   proxy support notes in the README). A proxy that terminates TLS and
     *   speaks HTTP/1.1 to origins cannot preserve HTTP/2 regardless.
     *
     * Defaults to `"1.1"`.
     */
    proxyHttpVersion?: "1.1" | "2" | undefined;
}
/**
 * Detect the proxy that applies to a URL and log a line when one is found.
 *
 * Standard proxy environment variables (`HTTP_PROXY` and `HTTPS_PROXY`,
 * respecting `NO_PROXY`) are auto-detected. When a proxy applies, a single line
 * is logged at startup so it is easy to know when a proxy is being used. The
 * proxy URL itself is not logged, since it can contain credentials.
 *
 * Takes an already-parsed `URL` so callers that also need it (e.g. to pick an
 * HTTP vs HTTPS agent) don't parse the base URL twice.
 *
 * @param url
 *   URL that requests will be made to.
 * @param options
 *   Configuration (optional).
 * @returns
 *   Proxy URL that applies to `url`, or `undefined` when no proxy applies.
 */
export declare function detectProxy(url: URL, options?: TransportOptions): string | undefined;
