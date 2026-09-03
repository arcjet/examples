import { Transport } from "@connectrpc/connect";
//#region src/connection-recycle.d.ts
/**
 * Consecutive deadline failures after which the connection is recycled.
 *
 * High enough that a couple of genuinely slow responses don't kill a healthy
 * connection (aborting also kills any concurrent in-flight streams), low
 * enough that a dead session costs only a few failed-open calls.
 */
declare const RECYCLE_AFTER_CONSECUTIVE_DEADLINES = 3;
/**
 * The subset of `Http2SessionManager` the wrapper needs.
 *
 * Narrowed so tests can inject a fake.
 */
interface RecyclableSession {
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
declare function withConnectionRecycling(transport: Transport, session: RecyclableSession): Transport;
//#endregion
export { RECYCLE_AFTER_CONSECUTIVE_DEADLINES, RecyclableSession, withConnectionRecycling };