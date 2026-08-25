import { CaptureOptions, Decision, GuardOptions } from "./types.js";
import { ArcjetGuard } from "./index.js";
//#region src/registry.d.ts
/**
 * Register a client for the free {@link guard}, {@link capture} and
 * {@link flush} functions.
 *
 * Guarded on purpose. If something tries to register a second client the first
 * one stays and the attempt is reported, so a library — or a stray second
 * `launchArcjet()` — cannot quietly redirect an application's telemetry to a
 * different key. Registering the client that is already registered is a no-op
 * rather than a warning, so a module evaluated twice stays silent.
 *
 * @example
 * ```ts
 * // instrumentation.ts, or whatever runs at startup
 * import { launchArcjet, registerArcjet } from "@arcjet/guard";
 *
 * registerArcjet(launchArcjet({ key: process.env.ARCJET_KEY! }));
 * ```
 */
declare function registerArcjet(client: ArcjetGuard): void;
/**
 * Clear the registered client, if any.
 *
 * Takes no argument and clears whatever is there. That asymmetry with
 * {@link registerArcjet} is deliberate: requiring the client back would mean
 * every teardown has to keep hold of it, which is the exact problem
 * registration exists to avoid.
 *
 * The cost is that anything calling this clears the application's client, and
 * every free call after it fails open. Libraries should not call it — they take
 * a client explicitly. That is a convention, not something enforced here.
 */
declare function unregisterArcjet(): void;
/**
 * Evaluate guard rules through the registered client.
 *
 * With nothing registered this returns a fail-open ALLOW carrying an error
 * result, so `decision.hasFailedOpen()` is true. It does not throw: these
 * functions behave exactly like the client methods they forward to, and the
 * never-throw contract holds.
 *
 * @example
 * ```ts
 * import { guard, detectPromptInjection } from "@arcjet/guard";
 *
 * const decision = await guard({
 *   label: "support.reply",
 *   rules: [detectPromptInjection()(userMessage)],
 * });
 * ```
 */
declare function guard(options: GuardOptions): Promise<Decision>;
/**
 * Record a fact about what the application did, through the registered client.
 *
 * With nothing registered the event is dropped silently. Capture is best-effort
 * telemetry, which is what makes dropping acceptable, and this path has no
 * configured logger to report to — the client that would have carried one is
 * the thing that is missing.
 *
 * Silence is the deliberate choice over an unconfigurable console warning,
 * which would be noise on a request path with no way to turn it off. Making
 * this observable is a future opt-in on the call itself, so an application that
 * wants to hear about it can ask.
 *
 * @example
 * ```ts
 * // deep in application code — nothing was passed down here
 * import { capture } from "@arcjet/guard";
 *
 * export async function refund(id: string): Promise<void> {
 *   await issueRefund(id);
 *   capture({ action: "refund.issued", metadata: { invoice: id } });
 * }
 * ```
 */
declare function capture(options: CaptureOptions): void;
/**
 * Drain the registered client's buffered capture events within a deadline.
 *
 * Resolves immediately with nothing registered — there is no queue to drain.
 */
declare function flush(timeoutMs?: number): Promise<void>;
//#endregion
export { capture, flush, guard, registerArcjet, unregisterArcjet };