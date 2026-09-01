import type { Transport } from "@connectrpc/connect";
export type { ProxyEnvironment, TransportLogger, TransportOptions } from "./detect-proxy.js";
import type { TransportOptions } from "./detect-proxy.js";
export declare function createTransport(baseUrl: string, _options?: TransportOptions): Transport;
