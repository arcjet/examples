import { encodeMetadata } from "./metadata.js";
import { symbolArcjetInternal } from "./symbol.js";
import { create } from "@bufbuild/protobuf";
import { detectSensitiveInfo } from "@arcjet/analyze";
import { EntityListSchema, GuardConclusion, GuardPolicyStatus, GuardReason, GuardRuleExecution, GuardRuleMode, GuardRuleSchema, GuardRuleSubmissionSchema, GuardSensitiveInfoEntitySchema, GuardStringMatchOperator, ResultErrorSchema, ResultLocalCustomSchema, ResultLocalSensitiveInfoSchema, RuleDetectPromptInjectionSchema, RuleFixedWindowSchema, RuleLocalCustomSchema, RuleLocalSensitiveInfoSchema, RuleModerateContentSchema, RuleSlidingWindowSchema, RuleTokenBucketSchema } from "./proto/proto/decide/v2/decide_pb.js";
//#region src/convert.ts
/**
* Proto ↔ SDK conversion functions for `@arcjet/guard`.
*
* This module converts between the generated protobuf types and the
* public SDK types defined in `./types.ts`. Callers should never need
* to import this module directly.
*
* @packageDocumentation
*/
/** Hash a string with SHA-256 and return the hex digest. */
async function sha256Hex(text) {
	const data = new TextEncoder().encode(text);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** No-op logger satisfying the `AnalyzeContext` contract. */
const noopLog = {
	debug() {},
	info() {},
	warn() {},
	error() {}
};
function billingFromProto(billing) {
	return billing ? {
		unit: billing.unit,
		count: billing.count
	} : void 0;
}
/** Minimal context for `@arcjet/analyze` — only `log` is used for sensitive info. */
const analyzeContext = {
	log: noopLog,
	characteristics: []
};
/**
* The {@link SensitiveInfoEntityType} values the bundled WASM engine detects
* natively. Every other declared type is only detected when a
* {@link SensitiveInfoBackend} that supports it is configured; listing one
* without such a backend is a configuration error (see `rules.ts`).
*
* Keep in sync with the native tags mapped in {@link stringToEntity}.
*
* @internal
*/
const nativeEntityTypes = /* @__PURE__ */ new Set([
	"EMAIL",
	"PHONE_NUMBER",
	"IP_ADDRESS",
	"CREDIT_CARD_NUMBER"
]);
/**
* Convert an SDK entity type string to an analyze entity tag.
*
* The four types the WebAssembly engine understands map to their native tag;
* every other {@link SensitiveInfoEntityType} (detected only by an alternative
* {@link SensitiveInfoBackend}) is carried as `{ tag: "custom", val }`. This is
* the inverse of {@link entityToString}.
*/
function stringToEntity(s) {
	if (s === "EMAIL") return { tag: "email" };
	if (s === "PHONE_NUMBER") return { tag: "phone-number" };
	if (s === "IP_ADDRESS") return { tag: "ip-address" };
	if (s === "CREDIT_CARD_NUMBER") return { tag: "credit-card-number" };
	return {
		tag: "custom",
		val: s
	};
}
/**
* Every declared {@link SensitiveInfoEntityType}. Used to validate the plain
* type strings a third-party {@link SensitiveInfoBackend} returns via a
* `{ tag: "custom" }` entity, so a misbehaving backend cannot inject arbitrary
* strings into `detectedEntityTypes` (and the union that downstream user code
* switches on).
*
* Keep in sync with the {@link SensitiveInfoEntityType} union in `./types.ts`.
*/
const knownEntityTypes = /* @__PURE__ */ new Set([
	"EMAIL",
	"PHONE_NUMBER",
	"IP_ADDRESS",
	"CREDIT_CARD_NUMBER",
	"GIVEN_NAME",
	"SURNAME",
	"SSN",
	"URL",
	"TAX_ID",
	"BANK_ACCOUNT",
	"ROUTING_NUMBER",
	"GOVERNMENT_ID",
	"PASSPORT",
	"DRIVERS_LICENSE",
	"BUILDING_NUMBER",
	"STREET_NAME",
	"SECONDARY_ADDRESS",
	"CITY",
	"STATE",
	"ZIP_CODE"
]);
/** Type guard: whether `value` is a declared {@link SensitiveInfoEntityType}. */
function isSensitiveInfoEntityType(value) {
	return knownEntityTypes.has(value);
}
/**
* Convert an analyze entity tag back to an SDK entity type string, or
* `undefined` when a backend returns a `custom` value outside the declared
* {@link SensitiveInfoEntityType} union.
*/
function entityToString(e) {
	switch (e.tag) {
		case "email": return "EMAIL";
		case "phone-number": return "PHONE_NUMBER";
		case "ip-address": return "IP_ADDRESS";
		case "credit-card-number": return "CREDIT_CARD_NUMBER";
		case "custom": return isSensitiveInfoEntityType(e.val) ? e.val : void 0;
	}
}
/**
* Default sensitive-info backend backed by the `@arcjet/analyze` WebAssembly
* engine.
*
* Used when a `localDetectSensitiveInfo` rule does not configure a `backend`.
* This preserves the existing behavior — local detection of email addresses,
* phone numbers, IP addresses, and credit card numbers.
*/
const wasmSensitiveInfoBackend = { detect(context, value, entities, options) {
	return detectSensitiveInfo({
		log: context.log,
		characteristics: []
	}, value, entities, options?.contextWindowSize ?? 1, options?.detect);
} };
/**
* Map a proto `GuardConclusion` to the SDK `Conclusion` string.
* Unrecognized values default to `"ALLOW"` (fail-open).
*
* @internal
*/
function conclusionFromProto(c) {
	switch (c) {
		case GuardConclusion.ALLOW:
		case GuardConclusion.UNSPECIFIED: return "ALLOW";
		case GuardConclusion.DENY: return "DENY";
	}
}
/**
* Map a proto result's oneof `case` to a broad SDK `Reason`.
*
* @internal
*/
function reasonFromCase(caseName) {
	switch (caseName) {
		case "tokenBucket":
		case "fixedWindow":
		case "slidingWindow": return "RATE_LIMIT";
		case "promptInjection": return "PROMPT_INJECTION";
		case "moderateContent": return "MODERATE_CONTENT";
		case "localSensitiveInfo": return "SENSITIVE_INFO";
		case "localCustom": return "CUSTOM";
		case "error": return "ERROR";
		case "notRun": return "NOT_RUN";
		case void 0: return "UNKNOWN";
		default: return "UNKNOWN";
	}
}
/**
* Map a proto `GuardReason` enum to the SDK `Reason` string.
*
* Used for the decision-level reason provided by the server, which
* follows a fixed priority (SensitiveInfo > RateLimit > PromptInjection > Custom).
*
* @internal
*/
function reasonFromProto(r) {
	switch (r) {
		case GuardReason.RATE_LIMIT: return "RATE_LIMIT";
		case GuardReason.PROMPT_INJECTION: return "PROMPT_INJECTION";
		case GuardReason.MODERATE_CONTENT: return "MODERATE_CONTENT";
		case GuardReason.SENSITIVE_INFO: return "SENSITIVE_INFO";
		case GuardReason.INPUT_CONSTRAINT: return "INPUT_CONSTRAINT";
		case GuardReason.CUSTOM: return "CUSTOM";
		case GuardReason.ERROR: return "ERROR";
		case GuardReason.NOT_RUN: return "NOT_RUN";
		case GuardReason.UNSPECIFIED: return "UNKNOWN";
		default: return "UNKNOWN";
	}
}
/**
* Convert a single proto `GuardRuleResult` to the SDK `RuleResult`.
*
* Each result variant carries its own conclusion and typed fields.
* `ResultError` results are mapped to `RuleResultError` with
* `conclusion: "ALLOW"` (fail-open). `ResultNotRun` results are mapped
* to `RuleResultNotRun` with `conclusion: "ALLOW"`.
*
* @internal
*/
function resultFromProto(pr) {
	const warnings = [];
	switch (pr.result.case) {
		case void 0: return {
			conclusion: "ALLOW",
			reason: "UNKNOWN",
			type: "UNKNOWN",
			warnings
		};
		case "tokenBucket": {
			const v = pr.result.value;
			return {
				conclusion: conclusionFromProto(v.conclusion),
				reason: "RATE_LIMIT",
				type: "TOKEN_BUCKET",
				warnings,
				remainingTokens: v.remainingTokens,
				maxTokens: v.maxTokens,
				resetAtUnixSeconds: v.resetAtUnixSeconds,
				refillRate: v.refillRate,
				refillIntervalSeconds: v.refillIntervalSeconds
			};
		}
		case "fixedWindow": {
			const v = pr.result.value;
			return {
				conclusion: conclusionFromProto(v.conclusion),
				reason: "RATE_LIMIT",
				type: "FIXED_WINDOW",
				warnings,
				remainingRequests: v.remainingRequests,
				maxRequests: v.maxRequests,
				resetAtUnixSeconds: v.resetAtUnixSeconds,
				windowSeconds: v.windowSeconds
			};
		}
		case "slidingWindow": {
			const v = pr.result.value;
			return {
				conclusion: conclusionFromProto(v.conclusion),
				reason: "RATE_LIMIT",
				type: "SLIDING_WINDOW",
				warnings,
				remainingRequests: v.remainingRequests,
				maxRequests: v.maxRequests,
				resetAtUnixSeconds: v.resetAtUnixSeconds,
				intervalSeconds: v.intervalSeconds
			};
		}
		case "promptInjection": {
			const v = pr.result.value;
			return {
				conclusion: conclusionFromProto(v.conclusion),
				reason: "PROMPT_INJECTION",
				type: "PROMPT_INJECTION",
				warnings,
				billing: billingFromProto(v.billing)
			};
		}
		case "moderateContent": {
			const v = pr.result.value;
			return {
				conclusion: conclusionFromProto(v.conclusion),
				reason: "MODERATE_CONTENT",
				type: "MODERATE_CONTENT",
				warnings,
				detected: v.detected,
				billing: billingFromProto(v.billing)
			};
		}
		case "localSensitiveInfo": {
			const v = pr.result.value;
			return {
				conclusion: conclusionFromProto(v.conclusion),
				reason: "SENSITIVE_INFO",
				type: "SENSITIVE_INFO",
				warnings,
				detectedEntityTypes: v.detectedEntityTypes
			};
		}
		case "localCustom": {
			const v = pr.result.value;
			return {
				conclusion: conclusionFromProto(v.conclusion),
				reason: "CUSTOM",
				type: "CUSTOM",
				warnings,
				data: Object.fromEntries(Object.entries(v.data))
			};
		}
		case "error": {
			const v = pr.result.value;
			return {
				conclusion: "ALLOW",
				reason: "ERROR",
				type: "RULE_ERROR",
				warnings,
				message: v.message || "Unknown error",
				code: v.code || "UNKNOWN"
			};
		}
		case "notRun": return {
			conclusion: "ALLOW",
			reason: "NOT_RUN",
			type: "NOT_RUN",
			warnings
		};
		default: return {
			conclusion: "ALLOW",
			reason: "UNKNOWN",
			type: "UNKNOWN",
			warnings
		};
	}
}
function policyResultFromProto(pr) {
	const warnings = [];
	let result;
	switch (pr.result.case) {
		case "promptInjection":
			result = {
				conclusion: conclusionFromProto(pr.result.value.conclusion),
				reason: "PROMPT_INJECTION",
				type: "PROMPT_INJECTION",
				warnings
			};
			break;
		case "localSensitiveInfo":
			result = {
				conclusion: conclusionFromProto(pr.result.value.conclusion),
				reason: "SENSITIVE_INFO",
				type: "SENSITIVE_INFO",
				warnings,
				detectedEntityTypes: pr.result.value.detectedEntityTypes
			};
			break;
		case "allowedStringValues":
		case "deniedStringValues":
		case "stringLength":
			result = {
				conclusion: conclusionFromProto(pr.result.value.conclusion),
				reason: "INPUT_CONSTRAINT",
				type: pr.result.case === "allowedStringValues" ? "ALLOWED_STRING_VALUES" : pr.result.case === "deniedStringValues" ? "DENIED_STRING_VALUES" : "STRING_LENGTH",
				...pr.result.case === "stringLength" ? {} : { matchOperator: pr.result.value.matchOperator === GuardStringMatchOperator.EMAIL_DOMAIN ? "EMAIL_DOMAIN" : pr.result.value.matchOperator === GuardStringMatchOperator.UNSPECIFIED || pr.result.value.matchOperator === GuardStringMatchOperator.EXACT ? "EXACT" : "UNKNOWN" },
				warnings
			};
			break;
		case "stringListMembership":
			result = {
				conclusion: conclusionFromProto(pr.result.value.conclusion),
				reason: "INPUT_CONSTRAINT",
				type: "STRING_LIST_MEMBERSHIP",
				matched: pr.result.value.matched,
				warnings
			};
			break;
		case "error":
			result = {
				conclusion: "ALLOW",
				reason: "ERROR",
				type: "RULE_ERROR",
				warnings,
				message: pr.result.value.message || "Unknown error",
				code: pr.result.value.code || "UNKNOWN"
			};
			break;
		case "notRun":
			result = {
				conclusion: "ALLOW",
				reason: "NOT_RUN",
				type: "NOT_RUN",
				warnings
			};
			break;
		case void 0: result = {
			conclusion: "ALLOW",
			reason: "UNKNOWN",
			type: "UNKNOWN",
			warnings
		};
	}
	return {
		policyId: pr.policyId,
		policyRevision: pr.policyRevision,
		ruleId: pr.ruleId,
		mode: pr.mode === GuardRuleMode.DRY_RUN ? "DRY_RUN" : "LIVE",
		execution: pr.execution === GuardRuleExecution.SDK ? "SDK" : pr.execution === GuardRuleExecution.SERVER ? "SERVER" : "UNKNOWN",
		source: "REMOTE",
		result
	};
}
function policyEvaluationFromProto(evaluation) {
	if (evaluation === void 0) return void 0;
	const statuses = {
		[GuardPolicyStatus.NOT_CONFIGURED]: "NOT_CONFIGURED",
		[GuardPolicyStatus.APPLIED]: "APPLIED",
		[GuardPolicyStatus.INCOMPLETE]: "INCOMPLETE",
		[GuardPolicyStatus.UNAVAILABLE]: "UNAVAILABLE"
	};
	return {
		revision: evaluation.revision,
		status: statuses[evaluation.status] ?? "UNKNOWN",
		refreshRequired: evaluation.refreshRequired
	};
}
/**
* Convert a `RuleWithInput` to a proto `GuardRuleSubmission`.
*
* Switches on the `type` discriminant so TypeScript narrows config/input
* automatically — no casts required.
*/
async function ruleToProto(rule, signal, options) {
	const mode = rule.config.mode === "DRY_RUN" ? GuardRuleMode.DRY_RUN : GuardRuleMode.LIVE;
	const guardRule = await ruleBodyToProto(rule, signal);
	const { metadataJson, localWarnings } = encodeMetadata(ruleMetadata(rule), `rules[${options?.ruleIndex ?? 0}].`);
	options?.warningsOut?.push(...localWarnings);
	const submission = {
		configId: rule[symbolArcjetInternal].configId,
		inputId: rule[symbolArcjetInternal].inputId,
		metadataJson,
		rule: guardRule,
		mode
	};
	if (rule.config.label !== void 0) submission.label = rule.config.label;
	return create(GuardRuleSubmissionSchema, submission);
}
/**
* Merge config-level and input-level metadata for a rule submission.
*
* The merge is shallow and top-level only: an input key replaces the config
* key's whole value, never deep-merging it. Every rule's `input` is an object
* carrying optional per-request `metadata`.
*
* @internal
*/
function ruleMetadata(rule) {
	return {
		...rule.config.metadata,
		...rule.input.metadata
	};
}
/**
* Map a `RuleWithInput` into a proto `GuardRule` using discriminant narrowing.
*
* @internal
*/
async function ruleBodyToProto(rule, signal) {
	switch (rule.type) {
		case "TOKEN_BUCKET": return create(GuardRuleSchema, { rule: {
			case: "tokenBucket",
			value: create(RuleTokenBucketSchema, {
				configRefillRate: rule.config.refillRate,
				configIntervalSeconds: rule.config.intervalSeconds,
				configMaxTokens: rule.config.maxTokens,
				configBucket: rule.config.bucket ?? "default-token-bucket",
				inputKeyHash: await sha256Hex(rule.input.key),
				inputRequested: rule.input.requested ?? 1
			})
		} });
		case "FIXED_WINDOW": return create(GuardRuleSchema, { rule: {
			case: "fixedWindow",
			value: create(RuleFixedWindowSchema, {
				configMaxRequests: rule.config.maxRequests,
				configWindowSeconds: rule.config.windowSeconds,
				configBucket: rule.config.bucket ?? "default-fixed-window",
				inputKeyHash: await sha256Hex(rule.input.key),
				inputRequested: rule.input.requested ?? 1
			})
		} });
		case "SLIDING_WINDOW": return create(GuardRuleSchema, { rule: {
			case: "slidingWindow",
			value: create(RuleSlidingWindowSchema, {
				configMaxRequests: rule.config.maxRequests,
				configIntervalSeconds: rule.config.intervalSeconds,
				configBucket: rule.config.bucket ?? "default-sliding-window",
				inputKeyHash: await sha256Hex(rule.input.key),
				inputRequested: rule.input.requested ?? 1
			})
		} });
		case "PROMPT_INJECTION": return create(GuardRuleSchema, { rule: {
			case: "detectPromptInjection",
			value: create(RuleDetectPromptInjectionSchema, { inputText: rule.input.inputText })
		} });
		case "MODERATE_CONTENT": return create(GuardRuleSchema, { rule: {
			case: "moderateContent",
			value: create(RuleModerateContentSchema, { inputText: rule.input.inputText })
		} });
		case "SENSITIVE_INFO": {
			const hash = await sha256Hex(rule.input.inputText);
			const entities = rule.config.deny ? {
				tag: "deny",
				val: rule.config.deny.map((s) => stringToEntity(s))
			} : {
				tag: "allow",
				val: (rule.config.allow ?? []).map((s) => stringToEntity(s))
			};
			let localResult;
			let resultDurationMs;
			const backend = rule.config.backend ?? wasmSensitiveInfoBackend;
			const evalStart = performance.now();
			try {
				const result = await backend.detect(analyzeContext, rule.input.inputText, entities, { contextWindowSize: 1 });
				resultDurationMs = BigInt(Math.round(performance.now() - evalStart));
				const deniedTypes = [...new Set(result.denied.map((d) => entityToString(d.identifiedType)).filter((t) => t !== void 0))];
				localResult = {
					case: "resultComputed",
					value: create(ResultLocalSensitiveInfoSchema, {
						conclusion: result.denied.length > 0 ? GuardConclusion.DENY : GuardConclusion.ALLOW,
						detected: deniedTypes.length > 0,
						detectedEntityTypes: deniedTypes,
						detectedEntities: result.denied.map((entity) => {
							const type = entityToString(entity.identifiedType);
							return type === void 0 ? void 0 : create(GuardSensitiveInfoEntitySchema, {
								type,
								start: entity.start,
								end: entity.end
							});
						}).filter((entity) => entity !== void 0)
					})
				};
			} catch (err) {
				resultDurationMs = BigInt(Math.round(performance.now() - evalStart));
				localResult = {
					case: "resultError",
					value: create(ResultErrorSchema, {
						message: err instanceof Error ? err.message : "sensitive info detection failed",
						code: "SENSITIVE_INFO_ERROR"
					})
				};
			}
			return create(GuardRuleSchema, { rule: {
				case: "localSensitiveInfo",
				value: create(RuleLocalSensitiveInfoSchema, {
					configEntityFilter: rule.config.deny ? {
						case: "configEntitiesDeny",
						value: create(EntityListSchema, { entities: rule.config.deny })
					} : {
						case: "configEntitiesAllow",
						value: create(EntityListSchema, { entities: rule.config.allow ?? [] })
					},
					inputTextHash: hash,
					localResult,
					resultDurationMs
				})
			} });
		}
		case "CUSTOM": {
			let localResult;
			let resultDurationMs;
			if (rule.evaluate) {
				const evalStart = performance.now();
				try {
					const evalResult = await rule.evaluate(rule.config.data ?? {}, rule.input.data, signal === void 0 ? {} : { signal });
					resultDurationMs = BigInt(Math.round(performance.now() - evalStart));
					if (evalResult.conclusion !== "ALLOW" && evalResult.conclusion !== "DENY") localResult = {
						case: "resultError",
						value: create(ResultErrorSchema, {
							message: `localCustom evaluate() returned invalid conclusion "${String(evalResult.conclusion)}" — must be "ALLOW" or "DENY"`,
							code: "INVALID_CONCLUSION"
						})
					};
					else localResult = {
						case: "resultComputed",
						value: create(ResultLocalCustomSchema, {
							conclusion: evalResult.conclusion === "DENY" ? GuardConclusion.DENY : GuardConclusion.ALLOW,
							data: evalResult.data ?? {}
						})
					};
				} catch (err) {
					resultDurationMs = BigInt(Math.round(performance.now() - evalStart));
					localResult = {
						case: "resultError",
						value: create(ResultErrorSchema, {
							message: err instanceof Error ? err.message : "Custom rule evaluation failed",
							code: "CUSTOM_EVAL_ERROR"
						})
					};
				}
			}
			const customValue = {
				configData: rule.config.data ?? {},
				inputData: rule.input.data
			};
			if (localResult !== void 0) customValue.localResult = localResult;
			if (resultDurationMs !== void 0) customValue.resultDurationMs = resultDurationMs;
			return create(GuardRuleSchema, { rule: {
				case: "localCustom",
				value: create(RuleLocalCustomSchema, customValue)
			} });
		}
	}
}
/**
* Coerce a value to a string with a fallback. Network data is untrusted — the
* proto's `ResultError` fields arrive over Connect-JSON, where a malformed
* response can put a non-string where a string is expected.
*/
function toStringOr(value, fallback) {
	return typeof value === "string" ? value : fallback;
}
/**
* Convert the proto `GuardResponse.errors` payload (non-fatal request
* validation diagnostics) into decision-level {@link Warning}s, validating
* each entry at the SDK boundary.
*/
function warningsFromProto(errors) {
	return errors.map((e) => ({
		code: toStringOr(e.code, "UNKNOWN"),
		message: toStringOr(e.message, "Unknown warning")
	}));
}
/**
* Build the shared diagnostic members every decision carries — `warnings` plus
* the derived `errorResults()` / `hasFailedOpen()` / `hasError()` helpers — from
* a conclusion, its results, and any decision-level warnings.
*
* `errorResults()` scans `results` for `RuleResultError` (which includes the
* synthetic error result used when a request could not be processed). It is
* computed once and closed over so `hasFailedOpen()` and `errorResults()` share
* a single scan rather than re-filtering on each call. `hasError()` is the
* deprecated conflated union (warnings ∪ errors).
*
* @internal
*/
function decisionMembers(conclusion, results, warnings, additionalErrors = []) {
	const errored = [...results.filter((r) => r.type === "RULE_ERROR"), ...additionalErrors];
	const errorResults = () => errored;
	return {
		warnings,
		errorResults,
		hasFailedOpen: () => conclusion === "ALLOW" && errored.length > 0,
		hasError: () => warnings.length > 0 || errored.length > 0
	};
}
/**
* Convert a proto `GuardResponse` to the SDK `Decision`.
*
* Correlates proto results back to SDK rule instances using
* `config_id` and `input_id`.
*/
function decisionFromProto(response, _rules, localWarnings = []) {
	const warnings = [...warningsFromProto(response.errors), ...localWarnings];
	const proto = response.decision;
	if (!proto) {
		const results = [{
			conclusion: "ALLOW",
			reason: "ERROR",
			type: "RULE_ERROR",
			warnings: [],
			message: "No decision in response",
			code: "NO_DECISION",
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
	const internalResults = [];
	for (const protoResult of proto.ruleResults) {
		const result = resultFromProto(protoResult);
		internalResults.push({
			...result,
			[symbolArcjetInternal]: {
				configId: protoResult.configId,
				inputId: protoResult.inputId
			}
		});
	}
	const results = internalResults;
	const policyErrors = policyErrorsFromProto(proto.policyEvaluation);
	const policyEvaluation = policyEvaluationFromProto(proto.policyEvaluation);
	const policyResults = proto.policyRuleResults.map(policyResultFromProto);
	const conclusion = conclusionFromProto(proto.conclusion);
	const reason = reasonFromProto(proto.reason);
	if (conclusion === "DENY") return {
		conclusion: "DENY",
		reason,
		id: proto.id,
		results,
		...policyEvaluation !== void 0 && { policyEvaluation },
		policyResults,
		...decisionMembers("DENY", results, warnings, policyErrors),
		[symbolArcjetInternal]: { results: internalResults }
	};
	return {
		conclusion: "ALLOW",
		id: proto.id,
		results,
		...policyEvaluation !== void 0 && { policyEvaluation },
		policyResults,
		...decisionMembers("ALLOW", results, warnings, policyErrors),
		[symbolArcjetInternal]: { results: internalResults }
	};
}
function policyErrorsFromProto(evaluation) {
	if (evaluation === void 0) return [];
	let message;
	switch (evaluation.status) {
		case GuardPolicyStatus.INCOMPLETE:
			message = "Remote Guard policy could not be fully evaluated";
			break;
		case GuardPolicyStatus.UNAVAILABLE:
			message = "Remote Guard policy is unavailable";
			break;
		case GuardPolicyStatus.UNSPECIFIED:
		case GuardPolicyStatus.NOT_CONFIGURED:
		case GuardPolicyStatus.APPLIED: return [];
	}
	return [{
		conclusion: "ALLOW",
		reason: "ERROR",
		type: "RULE_ERROR",
		warnings: [],
		code: "REMOTE_POLICY_UNAVAILABLE",
		message
	}];
}
//#endregion
export { conclusionFromProto, decisionFromProto, decisionMembers, isSensitiveInfoEntityType, nativeEntityTypes, reasonFromCase, reasonFromProto, resultFromProto, ruleToProto };
