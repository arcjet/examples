import { isSpoofedBot } from "@arcjet/inspect";
import arcjetNode, {
  ArcjetDecision,
  detectBot,
  shield,
  slidingWindow,
} from "@arcjet/node";
import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";

setGlobalOptions({ maxInstances: 10, secrets: ["ARCJET_KEY"] });

let arcjetKey = process.env.ARCJET_KEY;
if (!arcjetKey) {
  // In your app this should be a hard error! Here for the sake of the
  // example we just use an intentionally invalid key.
  arcjetKey = "";
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
  ],
});

// Use Ad hoc rules to set rate limits for guests and authenticated users.
// See https://docs.arcjet.com/reference/nodejs/#ad-hoc-rules for more

const arcjetForGuest = arcjet.withRule(
  // Create a token bucket rate limit. Other algorithms are supported.
  slidingWindow({
    // characteristics: ["ip.src"], // Defaults to "ip.src" if not specified
    mode: "LIVE",
    interval: "1m", // Refill every 1 minute
    max: 5, // Allow 5 requests per interval for guests
  }),
);

const arcjetForUser = arcjet.withRule(
  // Create a token bucket rate limit. Other algorithms are supported.
  slidingWindow({
    characteristics: ["user"], // Custom "user" characteristic
    mode: "LIVE",
    interval: "1m", // Refill every 1 minute
    max: 15, // Allow 15 requests per interval for guests
  }),
);

export const arcjetExample = onRequest(async (request, response) => {
  // In a real app you'd use proper authentication to identify users.
  // Here we just use a "user" query parameter for demonstration.
  const user =
    typeof request.query.user === "string" ? request.query.user : null;

  // Dynamically choose the Arcjet instance to use based on whether a user is
  // authenticated or this is a guest request.
  let decision: ArcjetDecision;
  if (user) {
    decision = await arcjetForUser.protect(request, { user });
  } else {
    decision = await arcjetForGuest.protect(request);
  }

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

  response.json({ message: `Hello ${user ?? "world"}` });
});
