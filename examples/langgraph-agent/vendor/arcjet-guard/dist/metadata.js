//#region src/metadata.ts
/** Warning code for a metadata key the SDK dropped before sending. */
const METADATA_ENCODE_FAILED_CODE = "AJ1017";
/** Longest key name echoed into a warning, matching the server's key cap. */
const MAX_REPORTED_KEY_LENGTH = 64;
/** Most key names listed in a single warning before the list is elided. */
const MAX_REPORTED_KEYS = 10;
/**
* SDK-side ceiling on the total metadata bytes in one request.
*
* This is a **protocol** backstop, not a copy of the server's policy limits, and
* it is deliberately well above them: the server caps a metadata map at 128 keys
* of 4 KiB (~512 KiB) and those caps are per-account and can be raised, so the
* SDK must never pre-empt them.
*
* What it protects against is the one immutable limit: a request over 1 MiB is
* rejected outright, before any per-key validation runs. A rejected request means
* no decision, which means a fail open — so without this ceiling, oversized
* attacker-derived metadata could change the security outcome, contrary to the
* guarantee that metadata never affects a decision. Counted as UTF-8 bytes of
* keys plus JSON-encoded values before compression, so the estimate is
* conservative.
*/
const MAX_METADATA_BYTES = 768 * 1024;
/**
* Whether `value` is a plain object usable as metadata.
*
* Arrays would encode as numeric string keys, and exotic objects (`Map`, `Date`,
* class instances) yield no own enumerable entries, so metadata would be
* silently ignored. Rejecting them up front keeps that from looking like it
* worked.
*/
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
* Whether a code point must be escaped before it goes in a warning message.
*
* C0 controls, DEL, the C1 range, and the Unicode line/paragraph separators are
* the characters that can break a log line or a JSON-ish log record. Everything
* else, including ordinary non-ASCII text, is echoed as-is.
*
* Kept identical to `_needs_escape` in arcjet-py so both SDKs render the same
* warning for the same key.
*/
function needsEscape(code) {
	return code < 32 || code >= 127 && code <= 159 || code >= 55296 && code <= 57343 || code === 8232 || code === 8233;
}
/**
* Render a metadata key for inclusion in a warning message.
*
* Keys are user-controlled, and warnings end up in application logs and in
* server-side storage, so control characters are escaped (a newline in a key
* could otherwise forge a log entry) and the result is length-bounded.
*/
function sanitizeKey(key) {
	let escaped = "";
	let length = 0;
	for (const character of key) {
		const code = character.codePointAt(0) ?? 0;
		let token;
		if (!needsEscape(code)) token = character;
		else if (code <= 255) token = `\\x${code.toString(16).padStart(2, "0")}`;
		else token = `\\u${code.toString(16).padStart(4, "0")}`;
		const cost = needsEscape(code) ? token.length : 1;
		if (length + cost > MAX_REPORTED_KEY_LENGTH) return `${escaped}...`;
		escaped += token;
		length += cost;
	}
	return escaped;
}
/**
* `JSON.stringify` replacer that refuses values arcjet-py would refuse.
*
* - Non-finite numbers: `JSON.stringify` turns `NaN` and `Infinity` into `null`,
*   silently changing the value. Throwing drops the key instead, matching
*   arcjet-py's `json.dumps(allow_nan=False)`.
* - Lone surrogates: not encodable as UTF-8, so arcjet-py drops the key rather
*   than let protobuf raise. `\p{Surrogate}` with the `u` flag matches only lone
*   surrogates, since a valid pair is a single code point.
*
* The replacer runs inside the serialization `JSON.stringify` already performs,
* so this costs no extra traversal. It sees every key and value, including
* nested ones.
*/
function rejectUnencodable(key, value) {
	if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("non-finite number");
	if (typeof value === "string" && loneSurrogate.test(value)) throw new TypeError("lone surrogate in value");
	if (loneSurrogate.test(key)) throw new TypeError("lone surrogate in key");
	return value;
}
/** Matches a surrogate not part of a valid pair (the `u` flag pairs them up). */
const loneSurrogate = /\p{Surrogate}/u;
/**
* JSON-encode each top-level value of `metadata` for the wire.
*
* @param metadata
*   User-supplied nested metadata, or `undefined`.
* @param messagePrefix
*   Prepended to the warning message to identify the source (such as
*   `"rules[0]."`), matching the server's convention.
* @returns
*   `metadataJson` maps each surviving key to its JSON-encoded value, ready for
*   the proto `metadata_json` field. `localWarnings` holds **at most one** entry,
*   naming every key that had to be dropped, so one call can never flood the
*   warning channel. Both are empty when `metadata` is missing, empty, or not a
*   plain object.
*/
function encodeMetadata(metadata, messagePrefix = "") {
	const encodedEntries = /* @__PURE__ */ new Map();
	if (!isPlainObject(metadata)) return {
		metadataJson: {},
		localWarnings: []
	};
	const dropped = [];
	let entries;
	try {
		entries = Object.entries(metadata);
	} catch {
		return {
			metadataJson: {},
			localWarnings: []
		};
	}
	for (const [key, value] of entries) {
		if (loneSurrogate.test(key)) {
			dropped.push(sanitizeKey(key));
			continue;
		}
		let encoded;
		try {
			encoded = JSON.stringify(value, rejectUnencodable);
		} catch {
			encoded = void 0;
		}
		if (typeof encoded === "string") encodedEntries.set(key, encoded);
		else dropped.push(sanitizeKey(key));
	}
	const metadataJson = Object.fromEntries(encodedEntries);
	if (dropped.length === 0) return {
		metadataJson,
		localWarnings: []
	};
	return {
		metadataJson,
		localWarnings: [{
			code: METADATA_ENCODE_FAILED_CODE,
			message: formatDropped(messagePrefix, "could not be JSON-encoded and were dropped", dropped)
		}]
	};
}
/** Render the key list for a warning, eliding once it gets long. */
function formatDropped(prefix, reason, keys) {
	let listed = keys.slice(0, MAX_REPORTED_KEYS).map(function(key) {
		return `"${key}"`;
	}).join(", ");
	if (keys.length > MAX_REPORTED_KEYS) listed += ", ...";
	return `${prefix}metadata: ${keys.length} key(s) ${reason}: ${listed}`;
}
/**
* Trim already-encoded metadata maps to {@linkcode MAX_METADATA_BYTES} in total.
*
* The maps are trimmed **in place**, in the order given, and within each map in
* insertion order: keys are kept until the running total would exceed the budget,
* and every key after that is dropped. Pass the request envelope's map first and
* each rule's map after it, so the order is stable across calls.
*
* One request can carry several metadata maps (a guard request has one per rule
* plus the envelope), so the ceiling has to be enforced across all of them rather
* than per map. See {@linkcode MAX_METADATA_BYTES} for why this exists at all.
*
* @param maps
*   Encoded metadata maps, in request order.
* @returns
*   At most one warning, naming the keys that were dropped.
*/
function enforceMetadataBudget(maps) {
	const encoder = new TextEncoder();
	const dropped = [];
	let total = 0;
	for (const map of maps) {
		const over = [];
		for (const [key, value] of Object.entries(map)) {
			if (total > 786432) {
				over.push(key);
				continue;
			}
			const size = encoder.encode(key).length + encoder.encode(value).length;
			if (total + size > 786432) {
				over.push(key);
				total = 786433;
				continue;
			}
			total += size;
		}
		for (const key of over) {
			delete map[key];
			dropped.push(sanitizeKey(key));
		}
	}
	if (dropped.length === 0) return [];
	return [{
		code: METADATA_ENCODE_FAILED_CODE,
		message: formatDropped("", `exceeded the ${MAX_METADATA_BYTES}-byte request metadata budget and were dropped`, dropped)
	}];
}
//#endregion
export { MAX_METADATA_BYTES, METADATA_ENCODE_FAILED_CODE, encodeMetadata, enforceMetadataBudget };
