import { symbolArcjetDiagnostics } from "./diagnostics.js";
import { policyInput } from "./policy-input.js";
import { defineCustomRule, detectPromptInjection, experimental_moderateContent, fixedWindow, localDetectSensitiveInfo, moderateContent, slidingWindow, tokenBucket } from "./rules.js";
import { createGuardClient } from "./client.js";
import { capture, flush, guard, registerArcjet, unregisterArcjet } from "./registry.js";
//#region src/index.ts
/**
* Create an Arcjet guard client with an explicit Connect transport.
*
* @internal Used by `node.ts` and `fetch.ts` to bind the correct transport.
*/
function launchArcjetWithTransport(options) {
	const client = createGuardClient({
		key: options.key,
		transport: options.transport,
		...options.logger === void 0 ? {} : { logger: options.logger },
		...options.sensitiveInfoBackend === void 0 ? {} : { sensitiveInfoBackend: options.sensitiveInfoBackend }
	});
	return {
		guard(opts) {
			return client.guard(opts);
		},
		capture(opts) {
			client.capture(opts);
		},
		flush(timeoutMs) {
			return client.flush(timeoutMs);
		},
		[symbolArcjetDiagnostics]: client[symbolArcjetDiagnostics]
	};
}
/**
* Create an Arcjet guard client using a user-supplied transport factory.
*
* @internal Used by `node.ts` and `web.ts` to bind the correct transport.
*/
function _launchWithTransportFactory(createTransport, options) {
	const transport = createTransport(options.baseUrl ?? "https://decide.arcjet.com");
	return launchArcjetWithTransport({
		...options,
		transport
	});
}
//#endregion
export { _launchWithTransportFactory, capture, defineCustomRule, detectPromptInjection, experimental_moderateContent, fixedWindow, flush, guard, launchArcjetWithTransport, localDetectSensitiveInfo, moderateContent, policyInput, registerArcjet, slidingWindow, tokenBucket, unregisterArcjet };
