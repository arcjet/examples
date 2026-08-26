import {
  detectPromptInjection,
  launchArcjet,
  localDetectSensitiveInfo,
  tokenBucket,
} from "@arcjet/guard";

const key = process.env.ARCJET_KEY;
if (!key) {
  throw new Error(
    "ARCJET_KEY is required. Copy .env.local.example to .env.local and set it.",
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

export const warehouseLimit = tokenBucket({
  bucket: "warehouse-notices",
  refillRate: 3,
  intervalSeconds: 60,
  maxTokens: 5,
});

// Factory then text — same shape as `detectPromptInjection()(text)`.
export const detectPii = localDetectSensitiveInfo();
export const detectInjection = detectPromptInjection();
