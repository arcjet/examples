import { detectProxy } from "./detect-proxy.js";
import { createConnectTransport } from "@connectrpc/connect-web";
//#region src/bun.ts
function createTransport(baseUrl, options) {
	detectProxy(new URL(baseUrl), options);
	return createConnectTransport({ baseUrl });
}
//#endregion
export { createTransport };
