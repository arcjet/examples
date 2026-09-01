import { createConnectTransport } from "@connectrpc/connect-web";
export function createTransport(baseUrl, 
// These edge runtimes don't support outbound proxy environment variables, so
// the options are accepted for API parity with the other entry points but no
// proxy is detected or used.
_options) {
    return createConnectTransport({
        baseUrl,
        fetch: fetchProxy,
    });
}
function fetchProxy(input, init) {
    return fetch(input, { ...init, redirect: "follow" });
}
