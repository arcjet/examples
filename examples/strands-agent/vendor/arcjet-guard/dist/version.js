//#region src/version.ts
/** SDK version. Updated by the release process. */
const VERSION = "1.10.0";
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
function userAgent() {
	const base = `arcjet-guard-js/${VERSION}`;
	const runtime = detectRuntime();
	const nav = globalThis.navigator === void 0 ? void 0 : globalThis.navigator.userAgent || void 0;
	const parts = [];
	if (runtime !== void 0 && runtime !== "") parts.push(runtime);
	if (nav !== void 0 && nav !== "" && nav !== runtime) parts.push(nav);
	return parts.length > 0 ? `${base} (${parts.join("; ")})` : base;
}
/**
* Detect the current runtime using WinterCG runtime keys.
*
* Returns the WinterCG key with version where available (e.g. `"node/22.22.1"`).
* Keys are always lowercase per the WinterCG registry.
*
* @see https://runtime-keys.proposal.wintercg.org/
* @see https://github.com/unjs/std-env/blob/main/src/runtimes.ts
*/
function detectRuntime() {
	const g = globalThis;
	if (typeof g !== "object" || g === null) return;
	if ("navigator" in g && g.navigator !== void 0 && typeof g.navigator === "object" && g.navigator !== null && "userAgent" in g.navigator && typeof g.navigator.userAgent === "string" && g.navigator.userAgent.includes("Cloudflare-Workers")) return "workerd";
	if ("EdgeRuntime" in g) return "edge-light";
	if ("Netlify" in g) return "netlify";
	if ("fastly" in g) return "fastly";
	if ("Deno" in g) {
		const deno = g["Deno"];
		if (typeof deno === "object" && deno !== null && "version" in deno) {
			const version = deno["version"];
			if (typeof version === "object" && version !== null && "deno" in version) {
				const v = version["deno"];
				if (typeof v === "string") return `deno/${v}`;
			}
		}
		return "deno";
	}
	if ("Bun" in g) {
		const bun = g["Bun"];
		if (typeof bun === "object" && bun !== null && "version" in bun) {
			const v = bun["version"];
			if (typeof v === "string") return `bun/${v}`;
		}
		return "bun";
	}
	if ("process" in g) {
		const proc = g["process"];
		if (typeof proc === "object" && proc !== null && "version" in proc) {
			const v = proc["version"];
			if (typeof v === "string") return `node/${v.replace(/^v/, "")}`;
		}
	}
}
//#endregion
export { VERSION, userAgent };
