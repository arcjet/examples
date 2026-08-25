import { create } from "@bufbuild/protobuf";
import { isSensitiveInfoEntityType, ruleToProto } from "./convert.js";
import { policyInputValue } from "./policy-input.js";
import { GetGuardPolicyRequestSchema, GuardLocalPolicyResultSchema, GuardPolicyInputKind, GuardPolicyInputSchema, GuardPolicyLocalInputSchema, GuardPolicyLookupStatus, GuardPolicyServerInputSchema, GuardConclusion, GuardRuleMode, GuardRuleType, GuardStringListSchema, ResultErrorSchema, ResultNotRunSchema, } from "./proto/proto/decide/v2/decide_pb.js";
import { localDetectSensitiveInfo } from "./rules.js";
/**
 * Capability tokens sent to the server so it knows this SDK can evaluate remote
 * Guard policies and local sensitive-info rules.
 *
 * @internal Exported for use by `client.ts`; not part of the public API.
 */
export const policyCapabilities = ["guard-policy-v1", "local-sensitive-info-v1"];
const policyRefreshIntervalMs = 5 * 60 * 1000;
const policyUnavailableRetryIntervalMs = 5 * 1000;
const policyUnavailableJitterRatio = 0.2;
/**
 * Fetches and caches SDK-local Guard policy projections, evaluates LOCAL inputs
 * against the cached projection, and encodes the inputs for transmission.
 *
 * @internal Not part of the public API.
 */
export class RemotePolicyRuntime {
    #results = new Map();
    #fetches = new Map();
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
        const hasLocal = entries.some(([, input]) => input.exposure === "LOCAL");
        const cached = hasLocal ? await this.#getResult(label, signal, forceRefresh) : undefined;
        const snapshot = cached?.status === "AVAILABLE" ? cached.policy : undefined;
        const inputs = {};
        const localValues = new Map();
        for (const [name, input] of entries) {
            if (input.exposure === "LOCAL") {
                const value = policyInputValue(input);
                if (typeof value !== "string")
                    throw new TypeError(`Policy input "${name}" must be a string`);
                const digest = await localStringDigest(value);
                localValues.set(name, { value, digest });
                inputs[name] = create(GuardPolicyInputSchema, {
                    representation: {
                        case: "local",
                        value: create(GuardPolicyLocalInputSchema, {
                            kind: GuardPolicyInputKind.STRING,
                            valueSha256: digest,
                        }),
                    },
                });
            }
            else {
                inputs[name] = serverInput(name, input);
            }
        }
        if (snapshot === undefined)
            return {
                inputs,
                revision: "",
                results: [],
                resultModes: {},
                sanitizeInputs: false,
                deniedLocally: false,
            };
        const results = [];
        let sanitizeInputs = false;
        let deniedLocally = false;
        for (const rule of snapshot.sensitiveInfoRules) {
            const local = localValues.get(rule.inputName);
            if (local === undefined)
                continue;
            if (deniedLocally) {
                results.push(create(GuardLocalPolicyResultSchema, {
                    policyId: snapshot.policyId,
                    policyRevision: snapshot.revision,
                    ruleId: rule.ruleId,
                    inputName: rule.inputName,
                    valueSha256: local.digest,
                    type: GuardRuleType.LOCAL_SENSITIVE_INFO,
                    result: { case: "notRun", value: create(ResultNotRunSchema) },
                }));
                continue;
            }
            const config = sensitiveInfoConfig(rule.entityFilter, this.#sensitiveInfoBackend);
            const submission = await ruleToProto(localDetectSensitiveInfo(config)(local.value), signal);
            const body = submission.rule?.rule;
            if (body?.case !== "localSensitiveInfo")
                continue;
            const localResult = body.value.localResult;
            const result = create(GuardLocalPolicyResultSchema, {
                policyId: snapshot.policyId,
                policyRevision: snapshot.revision,
                ruleId: rule.ruleId,
                inputName: rule.inputName,
                valueSha256: local.digest,
                type: GuardRuleType.LOCAL_SENSITIVE_INFO,
                ...(body.value.resultDurationMs !== undefined && {
                    durationMs: body.value.resultDurationMs,
                }),
                result: localResult.case === "resultComputed"
                    ? { case: "localSensitiveInfo", value: localResult.value }
                    : localResult.case === "resultError"
                        ? {
                            case: "error",
                            value: create(ResultErrorSchema, {
                                code: "LOCAL_POLICY_ERROR",
                                message: "local policy evaluation failed",
                            }),
                        }
                        : localResult.case === "resultNotRun"
                            ? { case: "notRun", value: localResult.value }
                            : { case: undefined },
            });
            results.push(result);
            const denied = result.result.case === "localSensitiveInfo" &&
                result.result.value.conclusion === GuardConclusion.DENY;
            sanitizeInputs ||= denied;
            deniedLocally ||= rule.mode === GuardRuleMode.LIVE && denied;
        }
        return {
            inputs,
            revision: snapshot.revision,
            results,
            resultModes: Object.fromEntries(snapshot.sensitiveInfoRules.map((rule) => [rule.ruleId, rule.mode])),
            sanitizeInputs,
            deniedLocally,
        };
    }
    // oxlint-disable-next-line eslint/require-await -- Cached branches return values; fetch branches return promises.
    async #getResult(label, signal, forceRefresh) {
        const now = performance.now();
        const cached = this.#results.get(label);
        if (!forceRefresh && cached !== undefined && now < cached.refreshAt)
            return cached;
        const existing = this.#fetches.get(label);
        if (existing !== undefined)
            return waitFor(existing, signal);
        // Projection retrieval is shared across requests. Do not let the first
        // request's cancellation abort the fleet-wide cached operation; each
        // waiter still observes its own signal through `waitFor`.
        const pending = this.#fetch(label, undefined, cached).finally(() => this.#fetches.delete(label));
        this.#fetches.set(label, pending);
        return waitFor(pending, signal);
    }
    async #fetch(label, signal, cached) {
        try {
            const request = create(GetGuardPolicyRequestSchema, {
                userAgent: this.#userAgent,
                label,
                policyCapabilities,
            });
            const options = {
                headers: { Authorization: `Bearer ${this.#key}` },
            };
            if (signal !== undefined)
                options.signal = signal;
            const response = await this.#fetchPolicy(request, options);
            if (response.status === GuardPolicyLookupStatus.NOT_CONFIGURED) {
                const result = Object.freeze({
                    status: "NOT_CONFIGURED",
                    refreshAt: performance.now() + policyRefreshIntervalMs,
                });
                this.#results.set(label, result);
                return result;
            }
            if (response.status !== GuardPolicyLookupStatus.AVAILABLE || response.policy === undefined) {
                return this.#retain(label, cached);
            }
            const receivedAt = performance.now();
            const result = Object.freeze({
                status: "AVAILABLE",
                policy: response.policy,
                refreshAt: receivedAt + policyRefreshIntervalMs,
            });
            this.#results.set(label, result);
            return result;
        }
        catch {
            return this.#retain(label, cached);
        }
    }
    #retain(label, cached) {
        const result = Object.freeze({
            ...(cached ?? { status: "UNAVAILABLE" }),
            refreshAt: performance.now() +
                (cached === undefined
                    ? jitter(policyUnavailableRetryIntervalMs, policyUnavailableJitterRatio)
                    : policyRefreshIntervalMs),
        });
        this.#results.set(label, result);
        return result;
    }
}
function jitter(intervalMs, ratio) {
    return intervalMs * (1 - ratio + Math.random() * ratio * 2);
}
function waitFor(promise, signal) {
    if (signal === undefined)
        return promise;
    if (signal.aborted)
        return Promise.reject(abortReason(signal));
    return new Promise((resolve, reject) => {
        const abort = () => {
            reject(abortReason(signal));
        };
        signal.addEventListener("abort", abort, { once: true });
        void promise.then(resolve, reject).finally(() => {
            signal.removeEventListener("abort", abort);
        });
    });
}
function abortReason(signal) {
    return signal.reason instanceof Error ? signal.reason : new Error("The operation was aborted");
}
function sensitiveInfoConfig(filter, backend) {
    // Policy entity names share the SDK's documented entity vocabulary and are
    // validated by the server-side policy compiler before projection.
    const entities = filter.value?.entities.filter(isSensitiveInfoEntityType) ?? [];
    if (filter.case === "entitiesAllow") {
        return { allow: entities, ...(backend === undefined ? {} : { backend }) };
    }
    if (filter.case === "entitiesDeny") {
        return { deny: entities, ...(backend === undefined ? {} : { backend }) };
    }
    return backend === undefined ? {} : { backend };
}
function serverInput(name, input) {
    const value = policyInputValue(input);
    let wire;
    switch (input.kind) {
        case "STRING":
            if (typeof value !== "string")
                throw new TypeError(`Policy input "${name}" must be a string`);
            wire = { case: "stringValue", value };
            break;
        case "BOOLEAN":
            if (typeof value !== "boolean")
                throw new TypeError(`Policy input "${name}" must be a boolean`);
            wire = { case: "booleanValue", value };
            break;
        case "INTEGER": {
            if (typeof value === "number" && !Number.isSafeInteger(value)) {
                throw new TypeError(`Policy input "${name}" must be a safe integer or bigint`);
            }
            if (typeof value !== "number" && typeof value !== "bigint") {
                throw new TypeError(`Policy input "${name}" must be an integer`);
            }
            wire = { case: "integerValue", value: BigInt(value) };
            break;
        }
        case "NUMBER":
            if (typeof value !== "number" || !Number.isFinite(value)) {
                throw new TypeError(`Policy input "${name}" must be a finite number`);
            }
            wire = { case: "numberValue", value };
            break;
        case "STRING_LIST":
            if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
                throw new TypeError(`Policy input "${name}" must be a string array`);
            }
            wire = { case: "stringListValue", value: create(GuardStringListSchema, { values: value }) };
            break;
    }
    return create(GuardPolicyInputSchema, {
        representation: {
            case: "server",
            value: create(GuardPolicyServerInputSchema, { value: wire }),
        },
    });
}
/**
 * Computes the domain-separated SHA-256 digest transmitted for a LOCAL string
 * input. The prefix and length-prefixed value guard against cross-context
 * collisions. This is correlation data, not anonymization: low-entropy values
 * remain trivially reversible, so it is not a privacy guarantee.
 *
 * @internal Exported for testing; not part of the public API.
 */
export async function localStringDigest(value) {
    const prefix = new TextEncoder().encode("arcjet.guard.policy-input.v1\0");
    const encoded = new TextEncoder().encode(value);
    const data = new Uint8Array(prefix.length + 4 + encoded.length);
    data.set(prefix);
    new DataView(data.buffer).setUint32(prefix.length, encoded.length, false);
    data.set(encoded, prefix.length + 4);
    return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}
