/**
 * `@arcjet/guard/testing` — an in-memory client for application tests.
 *
 * Registers a client that records what was called and talks to nothing. It
 * exists so a test can assert that application code captured the event it was
 * supposed to, without a key, a network, or a running server.
 *
 * This is deliberately not a mock server. It records calls and answers guards
 * uniformly; it does not let a test stub per-rule verdicts. Simulating real
 * decisions is a much larger job — closer to MSW than to a stub — and is not
 * what this is for.
 *
 * @packageDocumentation
 */
import type { ArcjetGuard } from "../index.ts";
import type { ArcjetMetadata, GuardOptions, Warning } from "../types.ts";
/** A capture event recorded by an {@link ArcjetTestClient}. */
export type ArcjetTestCapture = {
    /** What the application said it did. */
    action: string;
    /** Present only when the call supplied one. */
    correlationId?: string;
    /** Present only when the call supplied one. */
    decisionId?: string;
    /** The call's timestamp, or when it was recorded. */
    occurredAt: Date;
    /** Metadata as it would have been sent, decoded back from the wire. */
    metadata: ArcjetMetadata;
    /** Anything the SDK dropped or rewrote while encoding this event. */
    warnings: readonly Warning[];
};
/** An in-memory Arcjet client that records calls instead of sending them. */
export type ArcjetTestClient = ArcjetGuard & {
    /** Captured events, in call order. */
    readonly captures: readonly ArcjetTestCapture[];
    /** Guard calls, in call order. */
    readonly guards: readonly GuardOptions[];
    /**
     * Unregister the client.
     *
     * The very same function as `[Symbol.dispose]`, not a wrapper around it —
     * one reference under two names, so the two cannot drift and either one
     * survives being destructured off the client.
     *
     * Safe to call twice, so it works in an `afterEach` that also runs after a
     * failed test. This is the form every toolchain accepts; prefer `using`
     * where yours supports it.
     */
    unregister(): void;
    /**
     * Unregister via `using`.
     *
     * Two requirements come with this, both on the consumer rather than here.
     * The `using` *syntax* needs Node.js 24 to parse natively, or compilation
     * through TypeScript; Node.js 22 defines `Symbol.dispose` but cannot parse
     * `using`. And because this member appears in the published `.d.ts`, a
     * consumer compiling with `skipLibCheck: false` needs `esnext.disposable` in
     * their `lib` even if they never write `using` — {@link
     * ArcjetTestClient.unregister} is the way out for them.
     */
    [Symbol.dispose](): void;
};
/**
 * Register an in-memory client that records Guard and Capture calls.
 *
 * The one place launching and registering are a single act — a test that wanted
 * them apart would use `launchArcjet()` directly.
 *
 * Throws if a client is already registered. In an application a second
 * registration warns and carries on, because it should be survivable; in a test
 * it means an earlier test leaked one, and every assertion here would silently
 * read the wrong recorder.
 *
 * Captures are recorded as they happen, so assertions need no waiting. There is
 * no transport and no queue, which is why unregistering is synchronous — there
 * is nothing to drain.
 *
 * @example
 * ```ts
 * import { registerTestClient } from "@arcjet/guard/testing";
 * import { refund } from "./refund.ts";
 *
 * test("refund captures an event", () => {
 *   const arcjet = registerTestClient();
 *   try {
 *     refund("inv_1");
 *
 *     assert.equal(arcjet.captures[0]?.action, "refund.issued");
 *   } finally {
 *     arcjet.unregister();
 *   }
 * });
 * ```
 *
 */
export declare function registerTestClient(): ArcjetTestClient;
