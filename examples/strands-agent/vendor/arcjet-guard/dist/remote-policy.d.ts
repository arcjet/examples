import { PolicyInputMap } from "./policy-input.js";
import { SensitiveInfoBackend } from "./types.js";
import { create } from "@bufbuild/protobuf";
import { GetGuardPolicyRequestSchema, GetGuardPolicyResponse, GuardLocalPolicyResult, GuardPolicyInput, GuardRuleMode } from "./proto/proto/decide/v2/decide_pb.js";
//#region src/remote-policy.d.ts
/**
 * Capability tokens sent to the server so it knows this SDK can evaluate remote
 * Guard policies and local sensitive-info rules.
 *
 * @internal Exported for use by `client.ts`; not part of the public API.
 */
declare const policyCapabilities: string[];
type FetchPolicy = (request: ReturnType<typeof create<typeof GetGuardPolicyRequestSchema>>, options: {
  headers: Record<string, string>;
  signal?: AbortSignal;
}) => Promise<GetGuardPolicyResponse>;
/**
 * Wire-ready policy payload produced by {@link RemotePolicyRuntime.prepare}: the
 * encoded inputs to send, the cached projection `revision` they were evaluated
 * against, and any locally-computed rule results (e.g. sensitive info).
 *
 * @internal Not part of the public API.
 */
type PreparedPolicy = {
  inputs: Record<string, GuardPolicyInput>;
  revision: string;
  results: GuardLocalPolicyResult[];
  resultModes: Record<string, GuardRuleMode>;
  /** Any local sensitive-info result denied, so SERVER inputs must be removed. */
  sanitizeInputs: boolean;
  /** A LIVE local sensitive-info result denied, so no user data may be sent. */
  deniedLocally: boolean;
};
/**
 * Fetches and caches SDK-local Guard policy projections, evaluates LOCAL inputs
 * against the cached projection, and encodes the inputs for transmission.
 *
 * @internal Not part of the public API.
 */
declare class RemotePolicyRuntime {
  #private;
  constructor(key: string, userAgent: string, fetchPolicy: FetchPolicy, sensitiveInfoBackend?: SensitiveInfoBackend);
  /**
   * Encodes policy `inputs` for the given `label`: SERVER inputs are wrapped for
   * transmission, LOCAL inputs are hashed (only their digest leaves the SDK) and
   * evaluated against the cached projection. Pass `forceRefresh` to bypass the
   * cache after a revision mismatch.
   */
  prepare(label: string, inputMap: PolicyInputMap | undefined, signal: AbortSignal | undefined, forceRefresh?: boolean): Promise<PreparedPolicy>;
}
/**
 * Computes the domain-separated SHA-256 digest transmitted for a LOCAL string
 * input. The prefix and length-prefixed value guard against cross-context
 * collisions. This is correlation data, not anonymization: low-entropy values
 * remain trivially reversible, so it is not a privacy guarantee.
 *
 * @internal Exported for testing; not part of the public API.
 */
declare function localStringDigest(value: string): Promise<Uint8Array>;
//#endregion
export { PreparedPolicy, RemotePolicyRuntime, localStringDigest, policyCapabilities };