import { detectProxy } from "./detect-proxy.js";
import { createConnectTransport } from "@connectrpc/connect-web";
//#region src/transport-fetch.ts
/**
* Create a Connect transport using the web (fetch-based) protocol.
*
* Compatible with Deno, Cloudflare Workers, Vercel Edge,
* and any runtime providing the WHATWG Fetch API.
*
* Note: Bun's `"."` export resolves to the `bun` entrypoint for HTTP/2.
* This transport is still usable on Bun via `@arcjet/guard/fetch` but
* will only use HTTP/1.1.
*
* Overrides `redirect` to `"follow"` because some edge runtimes (workerd,
* edge-light) reject the `"error"` default set by connect-web.
*
* @see https://github.com/connectrpc/connect-es/issues/749
* @see https://github.com/connectrpc/connect-es/pull/1082
*/
function createTransport(baseUrl) {
	detectProxy(new URL(baseUrl));
	return createFetchTransport(baseUrl);
}
/**
* Build the fetch-based Connect transport without detecting a proxy.
*
* Separated from {@link createTransport} so the Node entry point can reuse it
* on Bun — where the proxy has already been detected and logged, and Bun's
* `fetch` performs the proxying itself — without logging the startup line a
* second time.
*
* Overrides `redirect` to `"follow"` because some edge runtimes (workerd,
* edge-light) reject the `"error"` default set by connect-web.
*/
function createFetchTransport(baseUrl) {
	return createConnectTransport({
		baseUrl,
		fetch: (input, init) => fetch(input, {
			...init,
			redirect: "follow"
		})
	});
}
//#endregion
export { createFetchTransport, createTransport };
