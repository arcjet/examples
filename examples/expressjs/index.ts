import path from "node:path";
import { cwd as processCwd } from "node:process";
import { fileURLToPath } from "node:url";
import { isSpoofedBot } from "@arcjet/inspect";
import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

if (!process.env.ARCJET_KEY) {
  throw new Error(
    "ARCJET_KEY environment variable is required. Sign up for your Arcjet key at https://app.arcjet.com",
  );
}

const aj = arcjet({
  // Get your site key from https://app.arcjet.com
  key: process.env.ARCJET_KEY,
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

// Arcjet middleware
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const decision = await aj.protect(req);

  console.log("Arcjet decision:", decision);

  if (decision.isDenied()) {
    if (decision.reason.isBot()) {
      res.writeHead(403, { "Content-Type": "text/html" });
      res.end("<h1>Forbidden</h1><p>Bots denied.</p>");
    } else if (decision.reason.isRateLimit()) {
      res.writeHead(429, { "Content-Type": "text/html" });
      res.end("<h1>Too Many Requests</h1><p>Rate limit exceeded.</p>");
    } else {
      res.writeHead(403, { "Content-Type": "text/html" });
      res.end("<h1>Forbidden</h1><p>Access denied.</p>");
    }
  }
  // https://docs.arcjet.com/bot-protection/reference#bot-verification
  // Test it with:
  // `curl -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" http://localhost:3000`
  else if (decision.results.some(isSpoofedBot)) {
    res.writeHead(403, { "Content-Type": "text/html" });
    res.end("<h1>Forbidden</h1><p>No spoofing!</p>");
  } else {
    next();
  }
});

app.use(express.static(path.join(processCwd(), "./public")));

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
