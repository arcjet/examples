/**
 * Outbound proxy detection shared by the `@arcjet/guard` transports.
 *
 * Resolves the proxy (if any) that applies to a base URL from the standard
 * proxy environment variables (`HTTP_PROXY`/`HTTPS_PROXY`, respecting
 * `NO_PROXY`) and logs a single line at startup when one is in use. The proxy
 * URL itself is never logged, since it can contain credentials.
 *
 * @packageDocumentation
 */
/** Map of environment variables used to detect an outbound proxy. */
export type ProxyEnvironment = Record<string, string | undefined>;
/**
 * Detect the proxy that applies to a URL and log a line when one is found.
 *
 * Standard proxy environment variables (`HTTP_PROXY` and `HTTPS_PROXY`,
 * respecting `NO_PROXY`) are auto-detected. When a proxy applies, a single line
 * is logged at startup so it is easy to know one is in use; the proxy URL itself
 * is not logged, since it can contain credentials.
 *
 * Takes an already-parsed `URL` so callers that also need it (e.g. to pick an
 * HTTP vs HTTPS agent) don't parse the base URL twice.
 *
 * @param url URL that requests will be made to.
 * @param proxyEnv Environment variables to inspect (defaults to the current
 *   runtime's environment when available).
 * @returns Proxy URL that applies to `url`, or `undefined` when none does.
 */
export declare function detectProxy(url: URL, proxyEnv?: ProxyEnvironment | undefined): string | undefined;
