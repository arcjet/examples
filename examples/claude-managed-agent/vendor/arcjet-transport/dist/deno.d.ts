import { ProxyEnvironment, TransportLogger, TransportOptions } from "./detect-proxy.js";
import { Transport } from "@connectrpc/connect";
//#region src/deno.d.ts
declare function createTransport(baseUrl: string, options?: TransportOptions): Transport;
//#endregion
export { type ProxyEnvironment, type TransportLogger, type TransportOptions, createTransport };