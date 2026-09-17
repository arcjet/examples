import { ProxyEnvironment, TransportLogger, TransportOptions } from "./detect-proxy.js";
import { Transport } from "@connectrpc/connect";
//#region src/workerd.d.ts
export declare function createTransport(baseUrl: string, _options?: TransportOptions): Transport;
//#endregion
export type { ProxyEnvironment, TransportLogger, TransportOptions };