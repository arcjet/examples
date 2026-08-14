import { launchArcjet, slidingWindow } from "@arcjet/guard";

export const arcjet = launchArcjet({
  // Get your site key from https://app.arcjet.com
  key: process.env.ARCJET_KEY!,
});

// HTTP-route cap before start(workflow). Tool/action limits live in the workflow.
export const startLimit = slidingWindow({
  bucket: "agent-start",
  maxRequests: 5,
  intervalSeconds: 60,
});
