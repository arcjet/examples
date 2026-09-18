//#region src/detect-proxy.ts
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
function detectProxy(url, proxyEnv = currentEnvironment()) {
	if (proxyEnv === void 0) return;
	let proxyUrl;
	try {
		proxyUrl = proxyForUrl(url, proxyEnv);
	} catch {
		return;
	}
	if (typeof proxyUrl === "string") {
		const level = proxyEnv["ARCJET_LOG_LEVEL"];
		if (level === "info" || level === "debug") console.info("Connecting to the Arcjet API through a proxy");
	}
	return proxyUrl;
}
/**
* Read the current runtime's environment, when available.
*
* `process` is available on Node, Deno, and Bun but not on every edge runtime,
* so we read it through `globalThis` (which is safe when it is absent) rather
* than referencing it directly or importing `node:process`.
*
* @returns The environment, or `undefined` on runtimes without `process`.
*/
function currentEnvironment() {
	return globalThis.process?.env;
}
/**
* Find the proxy that should be used for a URL, if any.
*
* Honors `NO_PROXY` so the result reflects the connection that will actually be
* made.
*
* @param url URL that requests will be made to.
* @param proxyEnv Environment variables to inspect.
* @returns Proxy URL to use, or `undefined` when no proxy applies.
*/
function proxyForUrl(url, proxyEnv) {
	const httpProxy = proxyEnv["REQUEST_METHOD"] === void 0 ? firstValue(proxyEnv["http_proxy"], proxyEnv["HTTP_PROXY"]) : firstValue(proxyEnv["http_proxy"]);
	const proxyUrl = url.protocol === "https:" ? firstValue(proxyEnv["https_proxy"], proxyEnv["HTTPS_PROXY"]) : httpProxy;
	if (typeof proxyUrl !== "string") return;
	if (isNoProxy(url, firstValue(proxyEnv["no_proxy"], proxyEnv["NO_PROXY"]))) return;
	return proxyUrl;
}
/**
* Determine whether a URL should bypass the proxy because of `NO_PROXY`.
*
* Supports the common `NO_PROXY` syntax: a comma- or space-separated list of
* host suffixes, an optional leading `.` or `*.`, an optional `:port`, and `*`
* to match everything. Entries are matched as host names; IP/CIDR ranges (e.g.
* `10.0.0.0/8`) are not supported, the same as curl.
*
* @param url URL that requests will be made to.
* @param noProxy Value of the `NO_PROXY` environment variable.
* @returns Whether the proxy should be bypassed.
*/
function isNoProxy(url, noProxy) {
	if (typeof noProxy !== "string") return false;
	const hostname = url.hostname.toLowerCase().replaceAll(/^\[|\]$/g, "");
	const port = url.port === "" ? url.protocol === "https:" ? "443" : "80" : url.port;
	for (const raw of noProxy.split(/[\s,]+/)) {
		if (raw === "") continue;
		if (raw === "*") return true;
		const entry = parseNoProxyEntry(raw);
		if (entry.port !== void 0 && entry.port !== port) continue;
		if (entry.host !== "" && hostMatches(hostname, entry.host)) return true;
	}
	return false;
}
/**
* Parse one `NO_PROXY` entry into its host and optional port.
*
* @param raw
*   A single entry from the `NO_PROXY` list (already split out and non-empty).
* @returns
*   The lowercased host (with any `*.`/`.` wildcard prefix and IPv6 brackets
*   removed) and the explicit `:port`, if the entry had one.
*/
function parseNoProxyEntry(raw) {
	const entry = raw.toLowerCase();
	let host = entry;
	let port;
	const bracketed = entry.match(/^\[(.+)\](?::([0-9]+))?$/);
	if (bracketed === null) {
		const colon = entry.lastIndexOf(":");
		if (colon !== -1 && colon === entry.indexOf(":") && /^[0-9]+$/.test(entry.slice(colon + 1))) {
			host = entry.slice(0, colon);
			port = entry.slice(colon + 1);
		}
	} else {
		host = bracketed[1] ?? "";
		port = bracketed[2];
	}
	return {
		host: host.replace(/^\*?\./, ""),
		port
	};
}
/**
* Whether a host name matches a `NO_PROXY` entry host, exactly or as a
* subdomain.
*
* @param hostname
*   Host name of the URL being requested.
* @param host
*   Host parsed from a `NO_PROXY` entry.
* @returns
*   Whether the host name is, or is a subdomain of, the entry host.
*/
function hostMatches(hostname, host) {
	return hostname === host || hostname.endsWith("." + host);
}
/**
* Get the first non-empty string from a list of values.
*
* @param values Values to inspect.
* @returns First non-empty string, or `undefined`.
*/
function firstValue(...values) {
	for (const value of values) if (typeof value === "string" && value !== "") return value;
}
//#endregion
export { detectProxy };
