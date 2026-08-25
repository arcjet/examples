/** Typed inputs for remotely configured Guard policies. */
const policyInputBrand = Symbol("arcjet.policy-input");
function server(kind, value) {
    return Object.freeze({ exposure: "SERVER", kind, [policyInputBrand]: value });
}
function local(value) {
    return Object.freeze({
        exposure: "LOCAL",
        kind: "STRING",
        [policyInputBrand]: value,
    });
}
/**
 * Constructors for wire-typed remote-policy inputs.
 *
 * Values built here are passed to `guard()`, `guardAction`, or `guardTool` via
 * their `inputs` option and made available to a remotely configured policy.
 * `server.*` values are transmitted to Arcjet; `local.*` values stay in SDK
 * memory and only their SHA-256 digest is sent.
 *
 * @example
 * ```ts
 * const sendEmail = guardTool(arcjet, emailTool, {
 *   action: "email.sent",
 *   onGuardError: "deny", // default — blocks the call if Arcjet is unreachable
 *   inputs: ({ recipient, body }) => ({
 *     recipient: policyInput.server.string(recipient),
 *     allowed_recipients: policyInput.server.stringList(allowlist),
 *     body: policyInput.local.string(body),
 *   }),
 * });
 * ```
 */
export const policyInput = Object.freeze({
    server: Object.freeze({
        string(value) {
            return server("STRING", value);
        },
        boolean(value) {
            return server("BOOLEAN", value);
        },
        integer(value) {
            return server("INTEGER", value);
        },
        number(value) {
            return server("NUMBER", value);
        },
        stringList(value) {
            return server("STRING_LIST", Object.freeze([...value]));
        },
    }),
    local: Object.freeze({
        string(value) {
            return local(value);
        },
    }),
});
/** @internal */
export function policyInputValue(input) {
    if (typeof input !== "object" || input === null || !(policyInputBrand in input)) {
        throw new TypeError("Guard policy inputs must be created with policyInput");
    }
    return input[policyInputBrand];
}
