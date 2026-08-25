//#region src/agents/ulid.ts
/**
* Crockford base32 alphabet used by ULID (no I, L, O, U).
*/
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
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
function ulid() {
	let timestamp = Date.now();
	let time = "";
	for (let i = 0; i < 10; i++) {
		time = ALPHABET[timestamp % 32] + time;
		timestamp = Math.floor(timestamp / 32);
	}
	const bytes = /* @__PURE__ */ new Uint8Array(16);
	crypto.getRandomValues(bytes);
	let random = "";
	for (const byte of bytes) random += ALPHABET[byte % 32];
	return time + random;
}
//#endregion
export { ulid };
