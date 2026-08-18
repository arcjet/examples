import { isSensitiveInfoEntityType, ruleToProto } from "./convert.js";
import { policyInputValue } from "./policy-input.js";
import { localDetectSensitiveInfo } from "./rules.js";
import { create } from "@bufbuild/protobuf";
import { GetGuardPolicyRequestSchema, GuardConclusion, GuardLocalPolicyResultSchema, GuardPolicyInputKind, GuardPolicyInputSchema, GuardPolicyLocalInputSchema, GuardPolicyLookupStatus, GuardPolicyServerInputSchema, GuardRuleMode, GuardRuleType, GuardStringListSchema, ResultErrorSchema, ResultNotRunSchema } from "./proto/proto/decide/v2/decide_pb.js";
//#region src/remote-policy.ts
/**
* Capability tokens sent to the server so it knows this SDK can evaluate remote
* Guard policies and local sensitive-info rules.
*
* @internal Exported for use by `client.ts`; not part of the public API.
*/
const policyCapabilities = ["guard-policy-v1", "local-sensitive-info-v1"];
const policyRefreshIntervalMs = 300 * 1e3;
const policyUnavailableRetryIntervalMs = 5 * 1e3;
const policyUnavailableJitterRatio = .2;
/**
* Fetches and caches SDK-local Guard policy projections, evaluates LOCAL inputs
* against the cached projection, and encodes the inputs for transmission.
*
* @internal Not part of the public API.
*/
var RemotePolicyRuntime = class {
	#results = /* @__PURE__ */ new Map();
	#fetches = /* @__PURE__ */ new Map();
	#key;
	#userAgent;
	#fetchPolicy;
	#sensitiveInfoBackend;
	constructor(key, userAgent, fetchPolicy, sensitiveInfoBackend) {
		this.#key = key;
		this.#userAgent = userAgent;
		this.#fetchPolicy = fetchPolicy;
		this.#sensitiveInfoBackend = sensitiveInfoBackend;
	}
	/**
	* Encodes policy `inputs` for the given `label`: SERVER inputs are wrapped for
	* transmission, LOCAL inputs are hashed (only their digest leaves the SDK) and
	* evaluated against the cached projection. Pass `forceRefresh` to bypass the
	* cache after a revision mismatch.
	*/
	async prepare(label, inputMap, signal, forceRefresh = false) {
		const entries = Object.entries(inputMap ?? {});
		const cached = entries.some(([, input]) => input.exposure === "LOCAL") ? await this.#getResult(label, signal, forceRefresh) : void 0;
		const snapshot = cached?.status === "AVAILABLE" ? cached.policy : void 0;
		const inputs = {};
		const localValues = /* @__PURE__ */ new Map();
		for (const [name, input] of entries) if (input.exposure === "LOCAL") {
			const value = policyInputValue(input);
			if (typeof value !== "string") throw new TypeError(`Policy input "${name}" must be a string`);
			const digest = await localStringDigest(value);
			localValues.set(name, {
				value,
				digest
			});
			inputs[name] = create(GuardPolicyInputSchema, { representation: {
				case: "local",
				value: create(GuardPolicyLocalInputSchema, {
					kind: GuardPolicyInputKind.STRING,
					valueSha256: digest
				})
			} });
		} else inputs[name] = serverInput(name, input);
		if (snapshot === void 0) return {
			inputs,
			revision: "",
			results: [],
			resultModes: {},
			sanitizeInputs: false,
			deniedLocally: false
		};
		const results = [];
		let sanitizeInputs = false;
		let deniedLocally = false;
		for (const rule of snapshot.sensitiveInfoRules) {
			const local = localValues.get(rule.inputName);
			if (local === void 0) continue;
			if (deniedLocally) {
				results.push(create(GuardLocalPolicyResultSchema, {
					policyId: snapshot.policyId,
					policyRevision: snapshot.revision,
					ruleId: rule.ruleId,
					inputName: rule.inputName,
					valueSha256: local.digest,
					type: GuardRuleType.LOCAL_SENSITIVE_INFO,
					result: {
						case: "notRun",
						value: create(ResultNotRunSchema)
					}
				}));
				continue;
			}
			const body = (await ruleToProto(localDetectSensitiveInfo(sensitiveInfoConfig(rule.entityFilter, this.#sensitiveInfoBackend))(local.value), signal)).rule?.rule;
			if (body?.case !== "localSensitiveInfo") continue;
			const localResult = body.value.localResult;
			const result = create(GuardLocalPolicyResultSchema, {
				policyId: snapshot.policyId,
				policyRevision: snapshot.revision,
				ruleId: rule.ruleId,
				inputName: rule.inputName,
				valueSha256: local.digest,
				type: GuardRuleType.LOCAL_SENSITIVE_INFO,
				...body.value.resultDurationMs !== void 0 && { durationMs: body.value.resultDurationMs },
				result: localResult.case === "resultComputed" ? {
					case: "localSensitiveInfo",
					value: localResult.value
				} : localResult.case === "resultError" ? {
					case: "error",
					value: create(ResultErrorSchema, {
						code: "LOCAL_POLICY_ERROR",
						message: "local policy evaluation failed"
					})
				} : localResult.case === "resultNotRun" ? {
					case: "notRun",
					value: localResult.value
				} : { case: void 0 }
			});
			results.push(result);
			const denied = result.result.case === "localSensitiveInfo" && result.result.value.conclusion === GuardConclusion.DENY;
			sanitizeInputs ||= denied;
			deniedLocally ||= rule.mode === GuardRuleMode.LIVE && denied;
		}
		return {
			inputs,
			revision: snapshot.revision,
			results,
			resultModes: Object.fromEntries(snapshot.sensitiveInfoRules.map((rule) => [rule.ruleId, rule.mode])),
			sanitizeInputs,
			deniedLocally
		};
	}
	async #getResult(label, signal, forceRefresh) {
		const now = performance.now();
		const cached = this.#results.get(label);
		if (!forceRefresh && cached !== void 0 && now < cached.refreshAt) return cached;
		const existing = this.#fetches.get(label);
		if (existing !== void 0) return waitFor(existing, signal);
		const pending = this.#fetch(label, void 0, cached).finally(() => this.#fetches.delete(label));
		this.#fetches.set(label, pending);
		return waitFor(pending, signal);
	}
	async #fetch(label, signal, cached) {
		try {
			const request = create(GetGuardPolicyRequestSchema, {
				userAgent: this.#userAgent,
				label,
				policyCapabilities
			});
			const options = { headers: { Authorization: `Bearer ${this.#key}` } };
			if (signal !== void 0) options.signal = signal;
			const response = await this.#fetchPolicy(request, options);
			if (response.status === GuardPolicyLookupStatus.NOT_CONFIGURED) {
				const result = Object.freeze({
					status: "NOT_CONFIGURED",
					refreshAt: performance.now() + policyRefreshIntervalMs
				});
				this.#results.set(label, result);
				return result;
			}
			if (response.status !== GuardPolicyLookupStatus.AVAILABLE || response.policy === void 0) return this.#retain(label, cached);
			const receivedAt = performance.now();
			const result = Object.freeze({
				status: "AVAILABLE",
				policy: response.policy,
				refreshAt: receivedAt + policyRefreshIntervalMs
			});
			this.#results.set(label, result);
			return result;
		} catch {
			return this.#retain(label, cached);
		}
	}
	#retain(label, cached) {
		const result = Object.freeze({
			...cached ?? { status: "UNAVAILABLE" },
			refreshAt: performance.now() + (cached === void 0 ? jitter(policyUnavailableRetryIntervalMs, policyUnavailableJitterRatio) : policyRefreshIntervalMs)
		});
		this.#results.set(label, result);
		return result;
	}
};
function jitter(intervalMs, ratio) {
	return intervalMs * (1 - ratio + Math.random() * ratio * 2);
}
function waitFor(promise, signal) {
	if (signal === void 0) return promise;
	if (signal.aborted) return Promise.reject(abortReason(signal));
	return new Promise((resolve, reject) => {
		const abort = () => {
			reject(abortReason(signal));
		};
		signal.addEventListener("abort", abort, { once: true });
		promise.then(resolve, reject).finally(() => {
			signal.removeEventListener("abort", abort);
		});
	});
}
function abortReason(signal) {
	return signal.reason instanceof Error ? signal.reason : /* @__PURE__ */ new Error("The operation was aborted");
}
function sensitiveInfoConfig(filter, backend) {
	const entities = filter.value?.entities.filter(isSensitiveInfoEntityType) ?? [];
	if (filter.case === "entitiesAllow") return {
		allow: entities,
		...backend === void 0 ? {} : { backend }
	};
	if (filter.case === "entitiesDeny") return {
		deny: entities,
		...backend === void 0 ? {} : { backend }
	};
	return backend === void 0 ? {} : { backend };
}
function serverInput(name, input) {
	const value = policyInputValue(input);
	let wire;
	switch (input.kind) {
		case "STRING":
			if (typeof value !== "string") throw new TypeError(`Policy input "${name}" must be a string`);
			wire = {
				case: "stringValue",
				value
			};
			break;
		case "BOOLEAN":
			if (typeof value !== "boolean") throw new TypeError(`Policy input "${name}" must be a boolean`);
			wire = {
				case: "booleanValue",
				value
			};
			break;
		case "INTEGER":
			if (typeof value === "number" && !Number.isSafeInteger(value)) throw new TypeError(`Policy input "${name}" must be a safe integer or bigint`);
			if (typeof value !== "number" && typeof value !== "bigint") throw new TypeError(`Policy input "${name}" must be an integer`);
			wire = {
				case: "integerValue",
				value: BigInt(value)
			};
			break;
		case "NUMBER":
			if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`Policy input "${name}" must be a finite number`);
			wire = {
				case: "numberValue",
				value
			};
			break;
		case "STRING_LIST":
			if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new TypeError(`Policy input "${name}" must be a string array`);
			wire = {
				case: "stringListValue",
				value: create(GuardStringListSchema, { values: value })
			};
			break;
	}
	return create(GuardPolicyInputSchema, { representation: {
		case: "server",
		value: create(GuardPolicyServerInputSchema, { value: wire })
	} });
}
/**
* Computes the domain-separated SHA-256 digest transmitted for a LOCAL string
* input. The prefix and length-prefixed value guard against cross-context
* collisions. This is correlation data, not anonymization: low-entropy values
* remain trivially reversible, so it is not a privacy guarantee.
*
* @internal Exported for testing; not part of the public API.
*/
async function localStringDigest(value) {
	const prefix = new TextEncoder().encode("arcjet.guard.policy-input.v1\0");
	const encoded = new TextEncoder().encode(value);
	const data = new Uint8Array(prefix.length + 4 + encoded.length);
	data.set(prefix);
	new DataView(data.buffer).setUint32(prefix.length, encoded.length, false);
	data.set(encoded, prefix.length + 4);
	return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}
//#endregion
export { RemotePolicyRuntime, localStringDigest, policyCapabilities };
