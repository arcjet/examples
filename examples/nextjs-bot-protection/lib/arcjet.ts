import arcjetNextjs, { detectBot } from "@arcjet/next";

// Get your site key from https://app.arcjet.com
// and set it as an environment variable rather than hard coding.
// See: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
let key = process.env.ARCJET_KEY;
if (!key) {
  // Normally we would throw an error here, but for the sake of the example
  // application we will just log a warning and use a dummy key.

  console.warn("Warning: ARCJET_KEY environment variable is not set.");
  console.warn(
    "Please set it to your Arcjet site key to enable bot protection.",
  );
  key = "arcjet_dummykey";
}

// Create a base Arcjet instance for use by each handler
export const arcjet = arcjetNextjs({
  key,
  rules: [
    detectBot({
      mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
      // Block all bots except the following
      allow: [
        "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc
        "OPENAI_CRAWLER", // OpenAI's web crawler
        // Uncomment to allow these other common bot categories
        // See the full list at https://arcjet.com/bot-list
        //"CATEGORY:MONITOR", // Uptime monitoring services
        "CATEGORY:PREVIEW", // Link previews e.g. Slack, Discord
      ],
    }),
  ],
});
