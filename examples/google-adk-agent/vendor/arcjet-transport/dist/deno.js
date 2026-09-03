import { detectProxy } from "./detect-proxy.js";
import { createConnectTransport } from "@connectrpc/connect-web";
//#region src/deno.ts
function createTransport(baseUrl, options) {
	detectProxy(new URL(baseUrl), options);
	return createConnectTransport({
		baseUrl,
		fetch: fetchProxy
	});
}
function fetchProxy(input, init) {
	return fetch(input, {
		...init,
		redirect: "follow"
	});
}
//#endregion
export { createTransport };
