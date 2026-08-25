import { DiagnosticHandler } from "./diagnostics.js";
import { CaptureEvent } from "./proto/proto/decide/v2/decide_pb.js";
//#region src/capture-delivery.d.ts
/** A platform hook that extends the current invocation for background work. */
type WaitUntil = (promise: Promise<unknown>) => void;
/** Internal tuning controls, exposed for deterministic tests. */
type CaptureDeliveryOptions = {
  /** Send one batch exactly once. */
  send: (events: readonly CaptureEvent[], signal: AbortSignal) => Promise<void>;
  /** Report a local failure that cannot travel over the wire. */
  diagnose: DiagnosticHandler;
  /**
   * Discover a platform `waitUntil` hook for this call, used only when the
   * caller did not supply one.
   *
   * Defaults to Vercel's request-context lookup, the only hook discoverable
   * without help. Platforms whose `waitUntil` is per invocation — Cloudflare's
   * `ExecutionContext` above all — cannot be discovered from a module-scoped
   * client and must supply it per call instead.
   */
  getWaitUntil?: () => WaitUntil | undefined;
  /** Most queued and in-flight events held in memory. */
  queueSize?: number;
  /** Most events in one Capture request. */
  batchSize?: number;
  /** Longest an event waits for a batch to fill. */
  batchDelayMs?: number;
};
/** Bounded, send-once delivery for best-effort capture events. */
type CaptureDelivery = {
  /**
   * Enqueue one event without blocking the caller.
   *
   * A `waitUntil` — supplied here, or discovered — is handed a promise that
   * settles when the queue has drained. It extends how long the invocation may
   * run; it does not make the event skip batching.
   *
   * A caller-supplied `waitUntil` takes precedence over discovery, matching how
   * `report()` prefers `ArcjetContext.waitUntil` over its own lookup.
   */
  capture(event: CaptureEvent, waitUntil?: WaitUntil): void;
  /** Drain queued and in-flight events within a deadline. */
  flush(timeoutMs?: number): Promise<void>;
};
/**
 * Create bounded, send-once delivery for best-effort capture events.
 *
 * The design follows the small bounded-buffer pattern used by telemetry SDKs:
 * one event queue, one pending-send set, and one unref'd batch timer. A full
 * buffer drops instead of blocking, and failed sends are never retried.
 */
declare function createCaptureDelivery(options: CaptureDeliveryOptions): CaptureDelivery;
//#endregion
export { CaptureDelivery, CaptureDeliveryOptions, WaitUntil, createCaptureDelivery };