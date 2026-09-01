import type { Transport } from "@connectrpc/connect";
export type { ProxyEnvironment, TransportLogger, TransportOptions } from "./detect-proxy.js";
import type { TransportOptions } from "./detect-proxy.js";
export declare function createTransport(baseUrl: string, options?: TransportOptions): Transport;
