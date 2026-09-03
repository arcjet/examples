import { Logger } from "@arcjet/logger";
//#region src/diagnostics.d.ts
/**
 * A local SDK diagnostic that cannot be reported over the wire.
 *
 * Messages contain static text and, for metadata encoding warnings, escaped
 * and length-bounded key names. They never include metadata values, capture
 * actions, credentials, headers, or request bodies.
 */
type ArcjetDiagnostic = {
  /** Stable machine-readable code. */
  code: "AJ1001" | "AJ1017" | "AJ3000" | "AJ3001" | "AJ3002" | "AJ3003" | "AJ3004" | "AJ3006";
  /** Static human-readable description. */
  message: string;
  /** Number of events affected, when relevant. */
  count?: number;
};
/** Logger methods used for local SDK diagnostics. */
type DiagnosticLogger = Pick<Logger, "warn">;
type DiagnosticHandler = (diagnostic: ArcjetDiagnostic) => void;
/**
 * Where a client keeps its diagnostics channel so the registry can reach it.
 *
 * A client's logger is captured inside `createGuardClient` and appears nowhere
 * on the public `ArcjetGuard` surface. Registration needs it anyway: when a
 * second client tries to register, the warning belongs to the application that
 * registered *first*, on the logger it configured — not on whatever sink the
 * late registrant brought with it.
 *
 * A symbol rather than a property so it stays invisible to `Object.keys` and
 * cannot collide with anything on a caller-supplied object.
 *
 * @internal
 */
declare const symbolArcjetDiagnostics: unique symbol;
/** A handler that holds counts back and can be asked to release them. */
type CoalescingDiagnosticHandler = DiagnosticHandler & {
  /** Report every count still held back, ignoring the quiet period. */
  drain(): void;
};
/** Internal tuning, exposed for deterministic tests. */
type DiagnosticOptions = {
  /**
   * Where to report. A supplied logger receives every diagnostic; without one,
   * the default `@arcjet/logger` sink coalesces.
   */
  logger?: DiagnosticLogger;
  /** Clock used for the quiet period. */
  now?: () => number;
  /** Quiet period per code, in milliseconds. `0` reports everything. */
  coalesceMs?: number;
};
/**
 * Build the diagnostics channel for one client.
 *
 * Diagnostics go through `@arcjet/logger`, so they are formatted and level-gated
 * like every other Arcjet log line rather than written straight to the console.
 *
 * A caller-supplied logger receives every diagnostic, because the caller already
 * controls filtering — anything keeping a metric of dropped events needs all of
 * them. The default logger coalesces instead: `capture()` is called on a request
 * path, so a persistent problem — a full queue under load, an unreachable API —
 * would otherwise emit a line per event and turn a best-effort telemetry drop
 * into a logging incident.
 *
 * Coalescing reports a code at most once per quiet period and **accumulates the
 * counts in between**, releasing them with the next line for that code or from
 * {@link CoalescingDiagnosticHandler.drain}, which `flush()` calls. Suppressing
 * without accumulating is the trap here: reporting only the first event of a
 * thousand-drop burst understates it by three orders of magnitude, which is what
 * this used to do.
 *
 * A burst that ends with neither a later drop nor a `flush()` still
 * under-reports. That is the residual cost of bounding log volume, and it is why
 * the figure is a count of events seen rather than a guaranteed total.
 */
declare function createDiagnosticHandler(options?: DiagnosticOptions): CoalescingDiagnosticHandler;
//#endregion
export { ArcjetDiagnostic, CoalescingDiagnosticHandler, DiagnosticHandler, DiagnosticLogger, DiagnosticOptions, createDiagnosticHandler, symbolArcjetDiagnostics };