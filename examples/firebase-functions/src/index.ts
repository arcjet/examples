import { isSpoofedBot } from "@arcjet/inspect";
import arcjetNode, { detectBot, shield, slidingWindow } from "@arcjet/node";
import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";

setGlobalOptions({ maxInstances: 10, secrets: ["ARCJET_KEY"] });

let arcjetKey = process.env.ARCJET_KEY;
if (!arcjetKey) {
  // In your app this should be a hard error! Here for the sake of the
  // example we just log an error and use an intentionally invalid key.
  logger.error(
    "ARCJET_KEY environment variable is not set. Sign up for free at https://app.arcjet.com to get your key.",
  );
  arcjetKey = "invalid";
}

const arcjet = arcjetNode({
  // Get your site key from https://app.arcjet.com
  key: arcjetKey,
  rules: [
    // Shield protects your app from common attacks e.g. SQL injection
    shield({ mode: "LIVE" }),
    // Create a bot detection rule
    detectBot({
      mode: "LIVE", // Blocks requests. Use "DRY_RUN" to log only
      // Block all bots except the following
      allow: [
        // See the full list at https://arcjet.com/bot-list
        "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc
        "CATEGORY:PREVIEW", // Link previews e.g. Slack, Discord
      ],
    }),
    // Create a token bucket rate limit. Other algorithms are supported.
    slidingWindow({
      mode: "LIVE",
      interval: "2s", // Refill every 2 seconds
      max: 5, // Allow 5 requests per interval
    }),
  ],
});

export const arcjetExample = onRequest(async (request, response) => {
  const decision = await arcjet.protect(request);

  logger.log("Arcjet decision:", decision);

  if (decision.isDenied()) {
    if (decision.reason.isBot()) {
      response.status(403).json({ message: "Bots denied." });
      return;
    }

    if (decision.reason.isRateLimit()) {
      response.status(429).json({ message: "Rate limit exceeded." });
      return;
    }

    response.status(403).json({ message: "Forbidden." });
    return;
  }

  // https://docs.arcjet.com/bot-protection/reference#bot-verification
  // Test it with:
  // `curl -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" <your function url>`
  if (decision.results.some(isSpoofedBot)) {
    response.status(403).json({ message: "No spoofing!" });
    return;
  }

  if (decision.isErrored()) {
    console.error("Arcjet error:", decision.reason);
    if (decision.reason.message === "[unauthenticated] invalid key") {
      response
        .status(403)
        .json({ message: "Invalid Arcjet key. Is the ARCJET_KEY secret set?" });
      return;
    }
    // Intentionally fail open for other Arcjet errors
  }

  response.json({ message: "Hello world" });
});
