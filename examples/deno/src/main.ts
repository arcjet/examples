import arcjet, { detectBot, shield, slidingWindow } from "npm:@arcjet/deno";
import { isSpoofedBot } from "npm:@arcjet/inspect";

const arcjetKey = Deno.env.get("ARCJET_KEY");
if (!arcjetKey) {
  throw new Error(
    "ARCJET_KEY environment variable is required. Sign up for your Arcjet key at https://app.arcjet.com",
  );
}

const aj = arcjet({
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

Deno.serve(
  { port: 3000 },
  aj.handler(async (req) => {
    const decision = await aj.protect(req);

    console.log("Arcjet decision", decision.conclusion);

    if (decision.isDenied()) {
      if (decision.reason.isBot()) {
        return new Response("No bots allowed", { status: 403 });
      }

      if (decision.reason.isRateLimit()) {
        return new Response("Too many requests", { status: 429 });
      }

      return new Response("Forbidden", { status: 403 });
    }

    // https://docs.arcjet.com/bot-protection/reference#bot-verification
    // Test it with:
    // `curl -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" http://localhost:3000`
    if (decision.results.some(isSpoofedBot)) {
      return new Response("No spoofed bots allowed", { status: 403 });
    }

    return new Response("Hello world");
  }),
);
