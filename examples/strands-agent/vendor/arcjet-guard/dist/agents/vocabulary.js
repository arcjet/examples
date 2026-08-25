//#region src/agents/vocabulary.ts
/**
* The same pairs, typed for iteration. `Object.entries` widens the key back to
* `string`; the narrowing is sound because the `satisfies` constraint above makes
* every key a field of `SecurityMetadataFields`. Built once at module load.
*/
const WIRE_KEY_ENTRIES = Object.entries({
	user: "user",
	agent: "agent",
	workflow: "workflow",
	dataClass: "data-class",
	destination: "destination",
	reversibility: "reversibility",
	resource: "resource"
});
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
function securityMetadata(fields) {
	const result = {};
	for (const [field, wireKey] of WIRE_KEY_ENTRIES) {
		const value = fields[field];
		if (value !== void 0) result[wireKey] = value;
	}
	return result;
}
//#endregion
export { securityMetadata };
