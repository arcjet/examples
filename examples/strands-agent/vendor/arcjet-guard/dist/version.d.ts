/** SDK version. Updated by the release process. */
export declare const VERSION = "1.10.0";
/**
 * Build a user-agent string with SDK version, runtime key, and navigator info.
 *
 * Uses WinterCG runtime keys (lowercase) as the canonical runtime identifier,
 * with version where available. Appends `navigator.userAgent` for additional
 * context since runtimes use their own capitalization there.
 *
 * Output examples:
 * - `"arcjet-guard-js/1.3.1 (node/22.22.1; Node.js/22)"`
 * - `"arcjet-guard-js/1.3.1 (bun/1.2.19; Bun/1.2.19)"`
 * - `"arcjet-guard-js/1.3.1 (deno/2.4.2; Deno/2.4.2)"`
 * - `"arcjet-guard-js/1.3.1 (workerd; Cloudflare-Workers)"`
 * - `"arcjet-guard-js/1.3.1 (edge-light)"`
 * - `"arcjet-guard-js/1.3.1"`
 *
 * @see https://runtime-keys.proposal.wintercg.org/
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgent
 */
export declare function userAgent(): string;
