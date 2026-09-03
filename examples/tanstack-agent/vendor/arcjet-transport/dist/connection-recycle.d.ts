/**
 * Dead-connection recovery for Arcjet HTTP/2 transports.
 *
 * A long-lived HTTP/2 session can die silently: an intermediary (NAT gateway,
 * L4 load balancer, connection-tracking table) can drop the connection state
 * during an idle period without sending a FIN or RST to either end. The client
 * then holds a session that looks open but black-holes every write, so every
 * RPC times out — and keeps timing out until TCP retransmission gives up many
 * minutes later, because nothing else tears the session down.
 *
 * The PING keep-alive configured in `http2.ts` detects most of this, but as a
 * backstop this wrapper watches RPC outcomes: after a run of consecutive
 * deadline failures with no success in between, it aborts the managed session
 * so the next call dials a fresh connection.
 *
 * Shared by `@arcjet/transport` (main SDK) and `@arcjet/guard` so both stay on
 * the same recovery behavior.
 */
import type { Transport } from "@connectrpc/connect";
/**
 * Consecutive deadline failures after which the connection is recycled.
 *
 * High enough that a couple of genuinely slow responses don't kill a healthy
 * connection (aborting also kills any concurrent in-flight streams), low
 * enough that a dead session costs only a few failed-open calls.
 */
export declare const RECYCLE_AFTER_CONSECUTIVE_DEADLINES = 3;
/**
 * The subset of `Http2SessionManager` the wrapper needs.
 *
 * Narrowed so tests can inject a fake.
 */
export interface RecyclableSession {
    abort(reason?: Error): void;
    connect(): Promise<unknown>;
}
/**
 * Wrap a transport so consecutive deadline failures recycle the connection.
 *
 * Only `Code.DeadlineExceeded` failures count: a dead-but-open session
 * manifests as every call timing out. Caller-initiated aborts surface as
 * `Code.Canceled`, and connection-level failures (refused, reset) already put
 * the session manager into its error state, from which it re-dials on its own.
 * Other errors neither count nor reset the run — only a success proves the
 * connection is alive.
 *
 * All RPCs share one HTTP/2 session, so when that session dies silently,
 * every RPC in flight on it times out — not just the three that reach the
 * threshold. Each RPC therefore records `generation` (the count of recycles
 * so far) when it starts, and deadline failures from before the latest
 * recycle are discarded: they describe the connection that was already
 * destroyed, not its replacement. Without this, a burst of concurrent
 * timeouts would tear down the replacement connection (and its successor)
 * before ever sending a request on it. Successes are not filtered this way:
 * a mistaken counter reset only delays a needed recycle by a few calls,
 * whereas a discarded success risks tearing down a healthy connection.
 *
 * The generation only advances on recycles performed here. The session
 * manager also replaces the connection on its own (failed PING verification,
 * idle timeout), and those swaps are invisible to this counter — so a
 * timeout run can, rarely, straddle two physical connections and retire a
 * healthy one early. That costs one redundant re-dial and is accepted as the
 * price of staying at the transport layer, which sees RPC outcomes but not
 * connection identity.
 *
 * @param transport Transport whose unary calls should be watched.
 * @param session Session manager to abort when the threshold is reached.
 * @returns A transport with the same behavior plus connection recycling.
 */
export declare function withConnectionRecycling(transport: Transport, session: RecyclableSession): Transport;
