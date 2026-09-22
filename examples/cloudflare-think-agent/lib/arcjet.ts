import {
  detectPromptInjection,
  launchArcjet,
  localDetectSensitiveInfo,
  tokenBucket,
} from "@arcjet/guard";

// The Node HTTP demo reads ARCJET_KEY at import time and throws if it is
// missing, so a misconfigured local server fails before it listens.
// On a Worker, set the same name as a secret (`wrangler secret put
// ARCJET_KEY`). `process.env` is populated only when the `nodejs_compat`
// compat flag is on (see wrangler.jsonc). Without that flag this module
// throws while the isolate boots, before any request runs.
const key = process.env.ARCJET_KEY;
if (!key) {
  throw new Error(
    "ARCJET_KEY is required. Copy .env.local.example to .env.local and set it. On Workers, set it as a secret and enable the nodejs_compat compat flag.",
  );
}

// Create the Arcjet client once at module scope.
export const arcjet = launchArcjet({
  // Get your site key from https://console.arcjet.com
  key,
});

// Rule configs are created once at module scope; inputs per call.
export const lookupLimit = tokenBucket({
  bucket: "order-lookups",
  refillRate: 5,
  intervalSeconds: 60,
  maxTokens: 10,
});

// Factory then text — same shape as `detectPromptInjection()(text)`.
export const detectPii = localDetectSensitiveInfo();
export const detectInjection = detectPromptInjection();
