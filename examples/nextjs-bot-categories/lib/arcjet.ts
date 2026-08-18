import arcjetNextjs, { botCategories, detectBot } from "@arcjet/next";

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
    // Detect bots with fine-grained control over which are allowed. This shows
    // three ways to build the allow list: by category, by individual bot, and
    // by filtering individual bots out of a category.
    detectBot({
      mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
      // Explicitly allow the bots below and deny all others. Use `deny` instead
      // to allow all bots except those you list.
      allow: [
        // Allow any developer tool, such as the `curl` command
        "CATEGORY:TOOL",
        // Allow a single detected bot, such as Vercel's screenshot bot
        "VERCEL_MONITOR_PREVIEW",
        // Allow all of Google's bots except AdsBot by expanding the category
        // into its individual bots and filtering out the ones we still deny
        ...botCategories["CATEGORY:GOOGLE"].filter(
          (bot) => bot !== "GOOGLE_ADSBOT" && bot !== "GOOGLE_ADSBOT_MOBILE",
        ),
      ],
    }),
  ],
});
