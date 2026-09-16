import { launchArcjet, tokenBucket } from "@arcjet/guard";

const key = process.env.ARCJET_KEY;
if (!key) {
  throw new Error(
    "ARCJET_KEY is required. Copy .env.local.example to .env.local and set it.",
  );
}

// Create the Arcjet client once at module scope
export const arcjet = launchArcjet({
  // Get your site key from https://console.arcjet.com
  key,
});

// Define rate limit rules at module scope
export const orderLookupLimit = tokenBucket({
  bucket: "order-lookup",
  refillRate: 10,
  intervalSeconds: 60,
  maxTokens: 10,
});

export const apiLimit = tokenBucket({
  bucket: "api-access",
  refillRate: 30,
  intervalSeconds: 60,
  maxTokens: 30,
});
