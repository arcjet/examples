import { CaptureOptions, Decision, GuardOptions, SensitiveInfoBackend, Warning } from "./types.js";
import { DiagnosticHandler, DiagnosticLogger, symbolArcjetDiagnostics } from "./diagnostics.js";
import { CaptureDeliveryOptions } from "./capture-delivery.js";
import { Transport } from "@connectrpc/connect";
import { CaptureEvent } from "./proto/proto/decide/v2/decide_pb.js";
//#region src/client.d.ts
/** Options for creating a guard client. */
interface GuardClientOptions {
  /** Arcjet key. */
  key: string;
  /** Connect RPC transport. */
  transport: Transport;
  /** User-agent product token (e.g. `"arcjet-guard-js/0.1.0"`). */
  userAgent?: string;
  /** Local diagnostics sink. */
  logger?: DiagnosticLogger;
  /** Alternative local sensitive-info backend for remotely configured policies. */
  sensitiveInfoBackend?: SensitiveInfoBackend;
  /** @internal Capture delivery controls used by deterministic tests. */
  captureDelivery?: Omit<CaptureDeliveryOptions, "send" | "diagnose">;
}
/**
 * Create a guard client that calls the Guard and Capture RPCs.
 *
 * The client can be shared across requests.
 */
declare function createGuardClient(options: GuardClientOptions): {
  guard(opts: GuardOptions): Promise<Decision>;
  capture(opts: CaptureOptions): void;
  flush(timeoutMs?: number): Promise<void>;
  /** @internal The client's diagnostics channel, for the registry. */
  [symbolArcjetDiagnostics]: DiagnosticHandler;
};
/**
 * Build the wire event for a `capture()` call, reporting anything dropped.
 *
 * Shared by the real client and the test client so a test asserts against the
 * event that would actually have been sent — same validation, same metadata
 * encoding, same warnings — rather than against the caller's raw input. A test
 * client that recorded the input instead would pass on a `capture()` the real
 * client drops.
 *
 * Returns `undefined` when the event is unusable, having already diagnosed it.
 * Never throws: the whole path runs inside the boundary, because plain
 * JavaScript callers can bypass the types and getters can throw while values
 * are read.
 *
 * @internal Not part of the public API. Unreachable outside the package: the
 * `exports` map lists no path that resolves here.
 */
declare function normalizeCaptureEvent(value: unknown, diagnose: DiagnosticHandler): CaptureEvent | undefined;
/**
 * Synthesize the fail-open ALLOW returned when a guard could not be evaluated.
 *
 * Shared with the registry so `guard()` with nothing registered degrades the
 * same way a transport failure does: an ALLOW carrying an error result, so
 * `hasFailedOpen()` reports true. Returning a plain ALLOW instead would be a
 * silent bypass — indistinguishable from a guard that ran and permitted the
 * call.
 *
 * @internal Not part of the public API. Unreachable outside the package: the
 * `exports` map lists no path that resolves here.
 */
declare function createFailOpenDecision(message: string, warnings?: readonly Warning[]): Decision;
//#endregion
export { GuardClientOptions, createFailOpenDecision, createGuardClient, normalizeCaptureEvent };