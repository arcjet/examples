import { ProxyEnvironment, TransportLogger, TransportOptions } from "./detect-proxy.js";
import { Transport } from "@connectrpc/connect";
//#region src/bun.d.ts
export declare function createTransport(baseUrl: string, options?: TransportOptions): Transport;
//#endregion
export type { ProxyEnvironment, TransportLogger, TransportOptions };