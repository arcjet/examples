import { createConnectTransport } from "@connectrpc/connect-web";
import { detectProxy } from "./detect-proxy.js";
export function createTransport(baseUrl, options) {
    // Deno's `fetch` performs the proxying itself; we detect to log a line.
    detectProxy(new URL(baseUrl), options);
    return createConnectTransport({
        baseUrl,
        fetch: fetchProxy,
    });
}
function fetchProxy(input, init) {
    return fetch(input, { ...init, redirect: "follow" });
}
