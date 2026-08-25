import { symbolArcjetDiagnostics } from "../diagnostics.js";
import { createFailOpenDecision, normalizeCaptureEvent } from "../client.js";
import { unregisterArcjet } from "../registry.js";
import { registerArcjetForTesting } from "./register.js";
//#region src/testing/index.ts
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
/**
* Diagnostics are dropped rather than logged.
*
* A test that captures something invalid asserts on the recorded event's
* `warnings`, which say the same thing in the place the test is already
* looking. Logging as well would put warnings in the output of every test that
* exercises a drop deliberately.
*/
const ignoreDiagnostic = () => {};
/**
* Clear the registration.
*
* Unconditional, because `unregisterArcjet()` takes no argument and clears
* whatever is there — which is this client in every ordinary case. Safe to call
* twice, so an `afterEach` still works after a failed test.
*/
function unregisterTestClient() {
	unregisterArcjet();
}
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
function registerTestClient() {
	const captures = [];
	const guards = [];
	const client = {
		captures,
		guards,
		guard(options) {
			guards.push(options);
			return Promise.resolve(createFailOpenDecision("guard() was called on the Arcjet test client; no rules ran"));
		},
		capture(options) {
			const event = normalizeCaptureEvent(options, ignoreDiagnostic);
			if (event === void 0) return;
			const metadata = {};
			for (const [key, value] of Object.entries(event.metadataJson)) Object.defineProperty(metadata, key, {
				configurable: true,
				enumerable: true,
				value: JSON.parse(value),
				writable: true
			});
			captures.push({
				action: event.action,
				...event.correlationId === "" ? {} : { correlationId: event.correlationId },
				...event.decisionId === "" ? {} : { decisionId: event.decisionId },
				occurredAt: new Date(Number(event.occurredAtUnixMs)),
				metadata,
				warnings: event.localWarnings.map((warning) => ({
					code: warning.code,
					message: warning.message
				}))
			});
		},
		flush() {
			return Promise.resolve();
		},
		unregister: unregisterTestClient,
		[Symbol.dispose]: unregisterTestClient,
		[symbolArcjetDiagnostics]: ignoreDiagnostic
	};
	registerArcjetForTesting(client);
	return client;
}
//#endregion
export { registerTestClient };
