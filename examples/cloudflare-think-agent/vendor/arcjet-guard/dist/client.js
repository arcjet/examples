import { createCaptureDelivery } from "./capture-delivery.js";
import { encodeMetadata, enforceMetadataBudget } from "./metadata.js";
import { symbolArcjetInternal } from "./symbol.js";
import { decisionFromProto, decisionMembers, ruleToProto } from "./convert.js";
import { createDiagnosticHandler, symbolArcjetDiagnostics } from "./diagnostics.js";
import { RemotePolicyRuntime, policyCapabilities } from "./remote-policy.js";
import { userAgent } from "./version.js";
import { create } from "@bufbuild/protobuf";
import { ConnectError, createClient } from "@connectrpc/connect";
import { CaptureEventSchema, CaptureRequestSchema, DecideService, GuardConclusion, GuardDecisionSchema, GuardPolicyEvaluationSchema, GuardPolicyRuleResultSchema, GuardPolicyStatus, GuardReason, GuardRequestSchema, GuardResponseSchema, GuardRuleExecution, GuardRuleMode, GuardRuleSource, WarningSchema } from "./proto/proto/decide/v2/decide_pb.js";
//#region src/client.ts
/**
* Guard RPC client for `@arcjet/guard`.
*
* Converts SDK rule objects to proto, calls the Guard RPC, and converts
* the response back to SDK types.
*
* @packageDocumentation
*/
/**
* The `source` set on every event this SDK produces from an explicit
* `capture()` call, recording where the event came from.
*
* An open string on the wire rather than an enum, because the set of producers
* isn't fixed — a future span-conversion path sends `"otlp"`. The server never
* substitutes a default, so an SDK that sends nothing leaves the origin
* unknown, which is deliberately distinct from `"sdk"`.
*/
const CAPTURE_SOURCE_SDK = "sdk";
/**
* Deadline for a `guard()` call when `timeoutSeconds` is not set.
*
* Sized for the slowest rules rather than the fastest: content moderation and
* prompt injection take materially longer than a rate-limit check, and a
* deadline yields a fail-open decision, so a tight default drops those rules
* instead of evaluating them.
*/
const DEFAULT_TIMEOUT_MS = 2e3;
/**
* Create a guard client that calls the Guard and Capture RPCs.
*
* The client can be shared across requests.
*/
function createGuardClient(options) {
	const { key, transport, userAgent: userAgent$1 = userAgent() } = options;
	const client = createClient(DecideService, transport);
	const remotePolicy = new RemotePolicyRuntime(key, userAgent$1, (request, callOptions) => client.getGuardPolicy(request, callOptions), options.sensitiveInfoBackend);
	const diagnose = createDiagnosticHandler(options.logger === void 0 ? {} : { logger: options.logger });
	const delivery = createCaptureDelivery({
		...options.captureDelivery,
		diagnose,
		async send(events, signal) {
			const captureRequest = create(CaptureRequestSchema, {
				userAgent: userAgent$1,
				sentAtUnixMs: BigInt(Date.now()),
				events: [...events]
			});
			await client.capture(captureRequest, {
				headers: { Authorization: `Bearer ${key}` },
				timeoutMs: 1e3,
				signal
			});
		}
	});
	return {
		/**
		* Evaluate a set of guard rules and return a decision.
		*
		*/
		async guard(opts) {
			opts.signal?.throwIfAborted();
			const requestMetadata = encodeMetadata(opts.metadata);
			const warnings = [];
			const startMs = performance.now();
			let preparedPolicy;
			try {
				preparedPolicy = await remotePolicy.prepare(opts.label, opts.inputs, opts.signal);
			} catch (cause) {
				opts.signal?.throwIfAborted();
				return failOpen(cause instanceof Error ? cause.message : "Policy input preparation failed", toWarnings(requestMetadata.localWarnings));
			}
			let sanitizePolicyInputs = preparedPolicy.sanitizeInputs;
			const timeoutMs = opts.timeoutSeconds !== void 0 && opts.timeoutSeconds !== 0 ? opts.timeoutSeconds * 1e3 : DEFAULT_TIMEOUT_MS;
			const callOptions = {
				headers: { Authorization: `Bearer ${key}` },
				timeoutMs
			};
			if (opts.signal) callOptions.signal = opts.signal;
			if (preparedPolicy.deniedLocally) {
				warnings.push(...requestMetadata.localWarnings, ...enforceMetadataBudget([requestMetadata.metadataJson]));
				const localPolicyWarnings = toWarnings(warnings);
				const guardRequest = create(GuardRequestSchema, {
					userAgent: userAgent$1,
					localEvalDurationMs: BigInt(Math.round(performance.now() - startMs)),
					sentAtUnixMs: BigInt(Date.now()),
					label: opts.label,
					metadataJson: requestMetadata.metadataJson,
					localWarnings: warnings.map((warning) => create(WarningSchema, warning)),
					correlationId: opts.correlationId ?? "",
					...opts.actor !== void 0 && { actor: opts.actor },
					policyInputs: localPolicyInputs(preparedPolicy),
					localPolicyRevision: preparedPolicy.revision,
					localPolicyResults: preparedPolicy.results,
					policyCapabilities
				});
				try {
					return decisionFromPrivacySafeResponse(await client.guard(guardRequest, callOptions), preparedPolicy, [], localPolicyWarnings);
				} catch {
					opts.signal?.throwIfAborted();
					return localPolicyDenial(preparedPolicy, localPolicyWarnings);
				}
			}
			let protoRules;
			try {
				const converted = await Promise.all((opts.rules ?? []).map(async function(rule, ruleIndex) {
					const ruleWarnings = [];
					return {
						submission: await ruleToProto(rule, opts.signal, {
							ruleIndex,
							warningsOut: ruleWarnings
						}),
						warnings: ruleWarnings
					};
				}));
				protoRules = converted.map(function(entry) {
					return entry.submission;
				});
				warnings.push(...converted.flatMap(function(entry) {
					return entry.warnings;
				}));
			} catch (cause) {
				opts.signal?.throwIfAborted();
				return failOpen(cause instanceof Error ? cause.message : "Local rule evaluation failed", toWarnings(requestMetadata.localWarnings));
			}
			opts.signal?.throwIfAborted();
			const localEvalDurationMs = BigInt(Math.round(performance.now() - startMs));
			const sentAtUnixMs = BigInt(Date.now());
			warnings.push(...requestMetadata.localWarnings, ...enforceMetadataBudget([requestMetadata.metadataJson, ...protoRules.map(function(rule) {
				return rule.metadataJson;
			})]));
			const guardRequest = create(GuardRequestSchema, {
				userAgent: userAgent$1,
				localEvalDurationMs,
				sentAtUnixMs,
				label: opts.label,
				metadataJson: requestMetadata.metadataJson,
				localWarnings: warnings.map((warning) => create(WarningSchema, warning)),
				ruleSubmissions: protoRules,
				correlationId: opts.correlationId ?? "",
				...opts.actor !== void 0 && { actor: opts.actor },
				policyInputs: sanitizePolicyInputs ? localPolicyInputs(preparedPolicy) : preparedPolicy.inputs,
				localPolicyRevision: preparedPolicy.revision,
				localPolicyResults: preparedPolicy.results,
				policyCapabilities
			});
			let response;
			try {
				response = await client.guard(guardRequest, callOptions);
				const policyEvaluation = response.decision?.policyEvaluation;
				if (opts.inputs !== void 0 && Object.values(opts.inputs).some((input) => input.exposure === "LOCAL") && (policyEvaluation?.refreshRequired === true || preparedPolicy.revision !== "" && policyEvaluation?.revision !== "" && policyEvaluation?.revision !== preparedPolicy.revision)) {
					preparedPolicy = await remotePolicy.prepare(opts.label, opts.inputs, opts.signal, true);
					sanitizePolicyInputs ||= preparedPolicy.sanitizeInputs;
					guardRequest.policyInputs = sanitizePolicyInputs ? localPolicyInputs(preparedPolicy) : preparedPolicy.inputs;
					guardRequest.localPolicyRevision = preparedPolicy.revision;
					guardRequest.localPolicyResults = preparedPolicy.results;
					if (preparedPolicy.deniedLocally) try {
						response = await client.guard(guardRequest, callOptions);
						return decisionFromPrivacySafeResponse(response, preparedPolicy, opts.rules ?? [], toWarnings(warnings));
					} catch {
						opts.signal?.throwIfAborted();
						return localPolicyDenial(preparedPolicy, toWarnings(warnings));
					}
					response = await client.guard(guardRequest, callOptions);
				}
			} catch (cause) {
				opts.signal?.throwIfAborted();
				return failOpen(cause instanceof ConnectError ? `[${cause.code}] ${cause.message}` : cause instanceof Error ? cause.message : "Unknown error", toWarnings(warnings));
			}
			opts.signal?.throwIfAborted();
			try {
				return decisionFromProto(response, opts.rules ?? [], toWarnings(warnings));
			} catch (cause) {
				return failOpen(cause instanceof Error ? cause.message : "Failed to parse server response", toWarnings(warnings));
			}
		},
		/** Record a fact about what the application did. */
		capture(opts) {
			try {
				const event = normalizeCaptureEvent(opts, diagnose);
				if (event === void 0) return;
				delivery.capture(event, readWaitUntil(opts));
			} catch {
				diagnose({
					code: "AJ3000",
					message: "Capture input was invalid; the event was dropped",
					count: 1
				});
			}
		},
		/** Drain buffered capture events within a deadline. */
		async flush(timeoutMs) {
			await delivery.flush(timeoutMs);
			diagnose.drain();
		},
		[symbolArcjetDiagnostics]: diagnose
	};
}
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
function normalizeCaptureEvent(value, diagnose) {
	try {
		const normalized = normalizeCaptureOptions(value);
		if (normalized === void 0) {
			diagnose({
				code: "AJ3000",
				message: "Capture input was invalid; the event was dropped",
				count: 1
			});
			return;
		}
		const occurredAtUnixMs = normalized.occurredAt === void 0 ? BigInt(Date.now()) : BigInt(normalized.occurredAt.getTime());
		const encoded = encodeMetadata(normalized.metadata);
		const warnings = [
			...normalized.localWarnings,
			...encoded.localWarnings,
			...enforceMetadataBudget([encoded.metadataJson])
		];
		for (const warning of warnings) diagnose(warning);
		return create(CaptureEventSchema, {
			occurredAtUnixMs,
			correlationId: normalized.correlationId ?? "",
			decisionId: normalized.decisionId ?? "",
			action: normalized.action,
			metadataJson: encoded.metadataJson,
			localWarnings: warnings.map((warning) => create(WarningSchema, warning)),
			source: CAPTURE_SOURCE_SDK
		});
	} catch {
		diagnose({
			code: "AJ3000",
			message: "Capture input was invalid; the event was dropped",
			count: 1
		});
		return;
	}
}
/**
* Normalize a capture envelope without letting one invalid optional field drop
* the whole event.
*
* Metadata values are validated by `encodeMetadata`: a value that cannot be
* represented as JSON drops only that key and becomes a per-event warning.
*/
function normalizeCaptureOptions(value) {
	if (!isPlainObject(value)) return;
	const action = readProperty(value, "action");
	if (!action.ok || typeof action.value !== "string" || action.value.length === 0) return;
	const normalized = {
		action: action.value,
		localWarnings: []
	};
	const correlationId = readProperty(value, "correlationId");
	if (correlationId.ok && typeof correlationId.value === "string") normalized.correlationId = correlationId.value;
	else if (!correlationId.ok || correlationId.value !== void 0) normalized.localWarnings.push(captureOptionDropped("correlationId"));
	const decisionId = readProperty(value, "decisionId");
	if (decisionId.ok && typeof decisionId.value === "string") normalized.decisionId = decisionId.value;
	else if (!decisionId.ok || decisionId.value !== void 0) normalized.localWarnings.push(captureOptionDropped("decisionId"));
	const occurredAt = readProperty(value, "occurredAt");
	if (occurredAt.ok && occurredAt.value instanceof Date && Number.isFinite(occurredAt.value.getTime()) && occurredAt.value.getTime() >= 0) normalized.occurredAt = occurredAt.value;
	else if (!occurredAt.ok || occurredAt.value !== void 0) normalized.localWarnings.push(captureOptionDropped("occurredAt"));
	const metadata = readProperty(value, "metadata");
	if (metadata.ok && isPlainObject(metadata.value)) normalized.metadata = metadata.value;
	else if (!metadata.ok || metadata.value !== void 0) normalized.localWarnings.push(captureOptionDropped("metadata"));
	return normalized;
}
/** Read one capture option without allowing a throwing getter to hide siblings. */
function readProperty(value, property) {
	try {
		return {
			ok: true,
			value: value[property]
		};
	} catch {
		return { ok: false };
	}
}
/**
* Read a caller-supplied `waitUntil` without trusting the input.
*
* A missing or non-callable value is treated as absent rather than warned
* about. Unlike the fields that reach the server, this one only selects a
* delivery path, and falling back to batching is what omitting it does anyway.
*/
function readWaitUntil(opts) {
	if (!isPlainObject(opts)) return;
	const waitUntil = readProperty(opts, "waitUntil");
	if (waitUntil.ok && isWaitUntil(waitUntil.value)) return waitUntil.value;
}
/**
* Whether a value can be called as a `waitUntil` hook.
*
* A predicate rather than an assertion: narrowing `unknown` to a function type
* is all we can check at runtime, and writing it as a guard keeps the claim
* where the check is instead of asserting past it at the call site.
*/
function isWaitUntil(value) {
	return typeof value === "function";
}
/** Describe an optional capture field dropped by client-side normalization. */
function captureOptionDropped(property) {
	return {
		code: "AJ1001",
		message: `capture.${property} was invalid and was dropped by the SDK`
	};
}
/** Whether a value is a plain object whose properties can be inspected. */
function isPlainObject(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	try {
		const prototype = Object.getPrototypeOf(value);
		return prototype === Object.prototype || prototype === null;
	} catch {
		return false;
	}
}
/**
* Synthesize a fail-open ALLOW decision from a transport or server error.
*
* Used when the server returns a `ConnectError` (e.g. validation failure,
* timeout, network error). The decision is ALLOW (fail-open) with a single
* error result carrying the message, plus any client-side metadata warnings so
* a dropped key is still reported when the call itself failed.
*/
function toWarnings(localWarnings) {
	return localWarnings.map((warning) => ({
		code: warning.code,
		message: warning.message
	}));
}
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
function createFailOpenDecision(message, warnings = []) {
	return failOpen(message, warnings);
}
function failOpen(message, warnings = []) {
	const results = [{
		conclusion: "ALLOW",
		reason: "ERROR",
		type: "RULE_ERROR",
		warnings: [],
		message,
		code: "TRANSPORT_ERROR",
		[symbolArcjetInternal]: {
			configId: "",
			inputId: ""
		}
	}];
	return {
		conclusion: "ALLOW",
		id: "",
		results,
		...decisionMembers("ALLOW", results, warnings),
		[symbolArcjetInternal]: { results }
	};
}
function localPolicyDenial(preparedPolicy, warnings) {
	const policyRuleResults = preparedPolicy.results.map((result) => create(GuardPolicyRuleResultSchema, {
		policyId: result.policyId,
		policyRevision: result.policyRevision,
		ruleId: result.ruleId,
		type: result.type,
		mode: preparedPolicy.resultModes[result.ruleId] ?? GuardRuleMode.LIVE,
		execution: GuardRuleExecution.SDK,
		source: GuardRuleSource.REMOTE,
		result: result.result
	}));
	return decisionFromProto(create(GuardResponseSchema, { decision: create(GuardDecisionSchema, {
		id: "",
		conclusion: GuardConclusion.DENY,
		reason: GuardReason.SENSITIVE_INFO,
		policyEvaluation: create(GuardPolicyEvaluationSchema, {
			revision: preparedPolicy.revision,
			status: GuardPolicyStatus.APPLIED
		}),
		policyRuleResults
	}) }), [], warnings);
}
function localPolicyInputs(preparedPolicy) {
	return Object.fromEntries(Object.entries(preparedPolicy.inputs).filter(([, input]) => input.representation.case === "local"));
}
function decisionFromPrivacySafeResponse(response, preparedPolicy, rules, warnings) {
	if (response.decision === void 0 || response.decision.id.length === 0) return localPolicyDenial(preparedPolicy, warnings);
	return decisionFromProto(response, rules, warnings);
}
//#endregion
export { createFailOpenDecision, createGuardClient, normalizeCaptureEvent };
