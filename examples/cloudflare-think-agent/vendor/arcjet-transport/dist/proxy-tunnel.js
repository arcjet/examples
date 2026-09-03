import * as net from "node:net";
import { Duplex } from "node:stream";
import * as tls from "node:tls";
//#region src/proxy-tunnel.ts
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
function createTunnelingConnection(proxyUrl) {
	const proxy = new URL(proxyUrl);
	const proxyIsHttps = proxy.protocol === "https:";
	const proxyPort = Number(proxy.port) || (proxyIsHttps ? 443 : 80);
	const proxyAuthorization = proxy.username === "" ? void 0 : "Basic " + Buffer.from(decodeURIComponent(proxy.username) + ":" + decodeURIComponent(proxy.password)).toString("base64");
	return function createConnection(authority, options) {
		const originIsHttps = authority.protocol === "https:";
		const originPort = Number(authority.port) || (originIsHttps ? 443 : 80);
		const originAuthority = authority.hostname + ":" + originPort;
		let tunnelReady = false;
		const pending = [];
		const bridge = new Duplex({
			read() {},
			write(chunk, _encoding, callback) {
				const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
				if (tunnelReady) proxySocket.write(buffer, callback);
				else pending.push({
					chunk: buffer,
					callback
				});
			}
		});
		const proxySocket = proxyIsHttps ? tls.connect({
			host: proxy.hostname,
			port: proxyPort,
			servername: proxy.hostname
		}) : net.connect({
			host: proxy.hostname,
			port: proxyPort
		});
		proxySocket.setNoDelay(true);
		proxySocket.once(proxyIsHttps ? "secureConnect" : "connect", () => {
			let request = "CONNECT " + originAuthority + " HTTP/1.1\r\n";
			request += "Host: " + originAuthority + "\r\n";
			if (proxyAuthorization !== void 0) request += "Proxy-Authorization: " + proxyAuthorization + "\r\n";
			request += "\r\n";
			proxySocket.write(request);
		});
		let head = Buffer.alloc(0);
		function onData(chunk) {
			head = Buffer.concat([head, chunk]);
			const terminator = head.indexOf("\r\n\r\n");
			if (terminator === -1) return;
			proxySocket.off("data", onData);
			const statusLine = head.subarray(0, head.indexOf("\r\n")).toString("latin1");
			const status = Number(statusLine.split(" ")[1]);
			if (!(status >= 200 && status < 300)) {
				const error = /* @__PURE__ */ new Error("Proxy CONNECT failed with status: " + statusLine.trim());
				proxySocket.destroy(error);
				bridge.destroy(error);
				return;
			}
			const leftover = head.subarray(terminator + 4);
			if (leftover.length > 0) bridge.push(leftover);
			if (originIsHttps) proxySocket.on("data", (data) => bridge.push(data));
			else {
				const maxFramePayload = 2 ** 20;
				let inbound = Buffer.alloc(0);
				proxySocket.on("data", (data) => {
					inbound = Buffer.concat([inbound, data]);
					while (inbound.length >= 9) {
						const payloadLength = inbound.readUIntBE(0, 3);
						if (payloadLength > maxFramePayload) {
							bridge.destroy(/* @__PURE__ */ new Error("Proxy tunnel received an oversized HTTP/2 frame"));
							return;
						}
						const frameLength = 9 + payloadLength;
						if (inbound.length < frameLength) break;
						const frame = inbound.subarray(0, frameLength);
						inbound = inbound.subarray(frameLength);
						setImmediate(() => {
							if (!bridge.destroyed) bridge.push(frame);
						});
					}
				});
			}
			proxySocket.on("end", () => setImmediate(() => {
				if (!bridge.destroyed) bridge.push(null);
			}));
			tunnelReady = true;
			for (const { chunk: queued, callback } of pending) proxySocket.write(queued, callback);
			pending.length = 0;
			head = Buffer.alloc(0);
		}
		proxySocket.on("data", onData);
		proxySocket.on("error", (error) => bridge.destroy(error));
		bridge.on("close", () => proxySocket.destroy());
		if (!originIsHttps) return bridge;
		const bareHostname = authority.hostname.startsWith("[") && authority.hostname.endsWith("]") ? authority.hostname.slice(1, -1) : authority.hostname;
		const originIsIpLiteral = net.isIP(bareHostname) !== 0;
		try {
			return tls.connect({
				...options,
				socket: bridge,
				host: bareHostname,
				servername: originIsIpLiteral ? void 0 : bareHostname,
				ALPNProtocols: ["h2"]
			});
		} catch (error) {
			proxySocket.destroy();
			bridge.destroy(error);
			throw error;
		}
	};
}
//#endregion
export { createTunnelingConnection };
