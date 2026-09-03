//#region src/capture-delivery.ts
const DEFAULT_QUEUE_SIZE = 1e3;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_BATCH_DELAY_MS = 100;
/**
* Create bounded, send-once delivery for best-effort capture events.
*
* The design follows the small bounded-buffer pattern used by telemetry SDKs:
* one event queue, one pending-send set, and one unref'd batch timer. A full
* buffer drops instead of blocking, and failed sends are never retried.
*/
function createCaptureDelivery(options) {
	const queueSize = positiveInteger(options.queueSize, DEFAULT_QUEUE_SIZE);
	const batchSize = positiveInteger(options.batchSize, DEFAULT_BATCH_SIZE);
	const batchDelayMs = nonnegativeInteger(options.batchDelayMs, DEFAULT_BATCH_DELAY_MS);
	const getWaitUntil = options.getWaitUntil ?? lookupWaitUntil;
	const queue = [];
	const pending = /* @__PURE__ */ new Set();
	let buffered = 0;
	let timer;
	let settledWaiters = [];
	function clearTimer() {
		if (timer !== void 0) {
			clearTimeout(timer);
			timer = void 0;
		}
	}
	function diagnoseDrop(code, count) {
		options.diagnose({
			code,
			message: {
				AJ3001: "Capture queue is full; newest events were dropped",
				AJ3002: "Capture batch send failed; events were dropped without retry",
				AJ3003: "Capture flush deadline expired; remaining events were dropped"
			}[code],
			count
		});
	}
	function startBatch(events) {
		const controller = new AbortController();
		let batch;
		const promise = Promise.resolve().then(() => options.send(events, controller.signal)).catch(() => {
			if (!batch.droppedByFlush) diagnoseDrop("AJ3002", batch.count);
		}).finally(() => {
			if (pending.delete(batch)) buffered -= batch.count;
			notifyIfSettled();
		});
		batch = {
			count: events.length,
			controller,
			promise,
			droppedByFlush: false
		};
		pending.add(batch);
		return batch;
	}
	function drainQueue() {
		clearTimer();
		while (queue.length > 0) startBatch(queue.splice(0, batchSize));
	}
	/**
	* Resolve once nothing is queued and nothing is in flight.
	*
	* This is what a platform `waitUntil` is handed: it keeps the invocation alive
	* until the events captured during it have actually been sent, without forcing
	* them to be sent one request at a time.
	*
	* Implemented by waking waiters from the drain path rather than by polling.
	* Re-checking through a resolved promise would build an unbroken microtask
	* chain while the queue waits out its batch window, and macrotasks — including
	* the batch timer that would have drained it — never get to run. That deadlocks
	* rather than waits.
	*/
	function whenSettled() {
		if (queue.length === 0 && pending.size === 0) return Promise.resolve();
		return new Promise((resolve) => {
			settledWaiters.push(resolve);
		});
	}
	/** Wake anything waiting on `whenSettled` once the pipeline is empty. */
	function notifyIfSettled() {
		if (queue.length > 0 || pending.size > 0 || settledWaiters.length === 0) return;
		const waiters = settledWaiters;
		settledWaiters = [];
		for (const resolve of waiters) resolve();
	}
	function schedule() {
		if (timer !== void 0) return;
		timer = setTimeout(() => {
			timer = void 0;
			drainQueue();
		}, batchDelayMs);
		unrefTimer(timer);
	}
	return {
		capture(event, callWaitUntil) {
			if (buffered >= queueSize) {
				diagnoseDrop("AJ3001", 1);
				return;
			}
			buffered += 1;
			queue.push(event);
			if (queue.length >= batchSize) drainQueue();
			else schedule();
			const waitUntil = typeof callWaitUntil === "function" ? callWaitUntil : safeWaitUntil(getWaitUntil);
			if (waitUntil !== void 0) try {
				waitUntil(whenSettled());
			} catch {}
		},
		async flush(timeoutMs = 1e3) {
			drainQueue();
			const batches = [...pending];
			if (batches.length === 0) return;
			const deadline = nonnegativeInteger(timeoutMs, 1e3);
			let timeout;
			const expired = new Promise((resolve) => {
				timeout = setTimeout(() => {
					resolve("expired");
				}, deadline);
			});
			const drained = Promise.all(batches.map((batch) => batch.promise)).then(() => "drained");
			const result = await Promise.race([drained, expired]);
			if (timeout !== void 0) clearTimeout(timeout);
			if (result === "drained") return;
			let dropped = 0;
			for (const batch of batches) if (pending.delete(batch)) {
				batch.droppedByFlush = true;
				buffered -= batch.count;
				dropped += batch.count;
				batch.controller.abort();
			}
			if (dropped > 0) diagnoseDrop("AJ3003", dropped);
		}
	};
}
function positiveInteger(value, fallback) {
	return Number.isSafeInteger(value) && value !== void 0 && value > 0 ? value : fallback;
}
function nonnegativeInteger(value, fallback) {
	return Number.isSafeInteger(value) && value !== void 0 && value >= 0 ? value : fallback;
}
function safeWaitUntil(getWaitUntil) {
	try {
		return getWaitUntil();
	} catch {
		return;
	}
}
function unrefTimer(timer) {
	if (hasUnref(timer)) timer.unref();
}
function hasUnref(value) {
	return value !== null && typeof value === "object" && "unref" in value && typeof value.unref === "function";
}
const SYMBOL_FOR_REQ_CONTEXT = Symbol.for("@vercel/request-context");
/**
* Discover Vercel's request-scoped `waitUntil` without a hard dependency.
*
* Same logic as `lookupWaitUntil` in the `arcjet` package, which `report()`
* uses. It is duplicated rather than shared because that copy is private and
* `arcjet` is not a dependency of this package; moving this package under
* `arcjet` puts both in one module graph, which is the point to delete one.
*
* The two predicates below look like ceremony next to that copy's inline
* `typeof` checks, but they are load-bearing here: inline narrowing leaves
* `waitUntil` typed as `Function`, and this package's lint runs the type-aware
* rules, so calling it trips `no-unsafe-call`. The predicates are how this stays
* free of an unchecked cast on a value that came off `globalThis`.
*/
function lookupWaitUntil() {
	const provider = globalThis[SYMBOL_FOR_REQ_CONTEXT];
	if (!isContextProvider(provider)) return;
	const vercelCtx = provider.get();
	if (isWaitUntilContext(vercelCtx)) return (promise) => {
		vercelCtx.waitUntil(promise);
	};
}
function isContextProvider(value) {
	return value !== null && typeof value === "object" && "get" in value && typeof value.get === "function";
}
function isWaitUntilContext(value) {
	return value !== null && typeof value === "object" && "waitUntil" in value && typeof value.waitUntil === "function";
}
//#endregion
export { createCaptureDelivery };
