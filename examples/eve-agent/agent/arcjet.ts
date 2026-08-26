import { launchArcjet, tokenBucket } from "@arcjet/guard";

// Create the Arcjet client once at module scope
export const arcjet = launchArcjet({
  // Get your site key from https://console.arcjet.com
  key: process.env.ARCJET_KEY ?? "",
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
