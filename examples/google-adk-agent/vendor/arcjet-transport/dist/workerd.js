import { createConnectTransport } from "@connectrpc/connect-web";
//#region src/workerd.ts
function createTransport(baseUrl, _options) {
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
