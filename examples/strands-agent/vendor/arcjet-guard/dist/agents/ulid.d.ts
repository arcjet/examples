//#region src/agents/ulid.d.ts
/**
 * Generate a ULID: 26 characters of Crockford base32 — a 48-bit millisecond
 * timestamp (10 chars) followed by 80 bits of randomness (16 chars).
 *
 * Sortable by creation time and safely within guard's correlation-ID rules
 * (≤256 bytes of printable ASCII).
 *
 * @internal Exported for use by the vendor namespaces, so every one of them
 * generates correlation ids the same way; not part of the public API.
 */
declare function ulid(): string;
//#endregion
export { ulid };