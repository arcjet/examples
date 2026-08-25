/**
 * Security metadata vocabulary for guard calls.
 *
 * Field names and their server-side wire keys for audit, policy decisions,
 * and integration with Arcjet's security model.
 */
/**
 * Maps each field to its guard wire key. Every key is its own name except
 * `dataClass`, which becomes the hyphenated `data-class`.
 *
 * The `satisfies` constraint ensures that every field of SecurityMetadataFields
 * has a corresponding wire key: omitting any field is a compile error, not a
 * runtime test failure.
 */
const WIRE_KEYS = {
    user: "user",
    agent: "agent",
    workflow: "workflow",
    dataClass: "data-class",
    destination: "destination",
    reversibility: "reversibility",
    resource: "resource",
};
/**
 * The same pairs, typed for iteration. `Object.entries` widens the key back to
 * `string`; the narrowing is sound because the `satisfies` constraint above makes
 * every key a field of `SecurityMetadataFields`. Built once at module load.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- keys are constrained by the satisfies above
const WIRE_KEY_ENTRIES = Object.entries(WIRE_KEYS);
/**
 * Map security metadata fields to their wire keys for Arcjet guard evaluation.
 *
 * Each field's value is passed through unchanged (type unions are suggestions,
 * not runtime validation). Undefined fields are omitted; empty strings you pass
 * are kept.
 *
 * @param fields - Security metadata dimensions
 * @returns A record mapping wire keys to string values, ready for guard context
 *
 * @example
 * ```ts
 * import { createAgentContext, securityMetadata } from "@arcjet/guard/vercel-ai/v7";
 *
 * const ctx = createAgentContext({
 *   correlationId: "req_12345",
 *   metadata: securityMetadata({
 *     user: "user_alice",
 *     dataClass: "confidential",
 *     destination: "audit_service",
 *   }),
 * });
 * // → context has metadata: { user: "user_alice", "data-class": "confidential", destination: "audit_service" }
 * ```
 */
export function securityMetadata(fields) {
    const result = {};
    for (const [field, wireKey] of WIRE_KEY_ENTRIES) {
        const value = fields[field];
        if (value !== undefined) {
            result[wireKey] = value;
        }
    }
    return result;
}
