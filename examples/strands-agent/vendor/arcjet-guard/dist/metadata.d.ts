/**
 * Nested-JSON `metadata` encoding for `@arcjet/guard`.
 *
 * `metadata` is a record of string keys to arbitrary JSON-serializable values
 * (nested objects, arrays, numbers, booleans, `null`, strings). The wire format
 * is `map<string, string>`: each **top-level** value is JSON-encoded
 * independently and stored verbatim, so value formatting survives the round
 * trip.
 *
 * Encoding is the SDK's only client-side responsibility here. The limits — 128
 * top-level keys, 4 KiB per serialized value, 10 levels of nesting, and
 * key-name validity — are enforced server-side (they are configurable per
 * account and can be raised), and every key the server drops comes back on
 * `decision.warnings`. The one drop the SDK must make itself is a value
 * `JSON.stringify` cannot represent faithfully: `undefined`, a function, a
 * symbol, a `BigInt`, a circular reference, or a non-finite number (`NaN`,
 * `Infinity`). Those are dropped with an `AJ1017` warning
 * reported to the server in `local_warnings` so the drop is never silent.
 *
 * Encoding never throws and never affects a decision: a bad value costs you
 * that one key, not the call.
 *
 * `@arcjet/protocol` carries a copy of this logic for `protect()`. The two
 * packages are deliberately independent (guard vendors its own proto), so the
 * duplication mirrors what is already there rather than adding a dependency.
 *
 * @packageDocumentation
 */
/**
 * Metadata for correlation and analytics: string keys mapped to any
 * JSON-serializable value, including nested objects and arrays.
 *
 * Typed as `unknown` values rather than a recursive JSON type on purpose — a
 * strict type rejects ordinary interfaces (they do not satisfy an index
 * signature), which would make a fail-open field a compile error. Values that
 * cannot be JSON-encoded are dropped at runtime with a warning instead.
 *
 * Two JavaScript-specific notes:
 *
 * - Numbers are IEEE-754 doubles, so an integer above `Number.MAX_SAFE_INTEGER`
 *   loses precision before it reaches the wire. Pass such values as strings.
 * - `BigInt` cannot be JSON-encoded and is dropped; convert it yourself.
 */
export type ArcjetMetadata = Record<string, unknown>;
/**
 * A client-side validation warning reported to the server in `local_warnings`.
 */
export interface LocalWarning {
    /** Machine-readable code. */
    code: "AJ1001" | "AJ1017";
    /**
     * Human-readable description. Names only the offending keys, never the
     * values, and only after escaping and length-bounding them — warnings are
     * persisted and reach application logs, so they must not become a PII sink or
     * a log-forging vector.
     */
    message: string;
}
/** Warning code for a metadata key the SDK dropped before sending. */
export declare const METADATA_ENCODE_FAILED_CODE = "AJ1017";
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
export declare const MAX_METADATA_BYTES: number;
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
export declare function encodeMetadata(metadata: ArcjetMetadata | undefined, messagePrefix?: string): {
    metadataJson: Record<string, string>;
    localWarnings: LocalWarning[];
};
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
export declare function enforceMetadataBudget(maps: ReadonlyArray<Record<string, string>>): LocalWarning[];
