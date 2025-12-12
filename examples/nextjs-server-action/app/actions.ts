"use server";

import arcjet, {
  detectBot,
  request,
  shield,
  slidingWindow,
} from "@arcjet/next";
import { redirect } from "next/navigation";

// Get your site key from https://app.arcjet.com
// and set it as an environment variable rather than hard coding.
// See: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
let key = process.env.ARCJET_KEY;
if (!key) {
  // Normally we would throw an error here, but for the sake of the example
  // application we will just log a warning and use a dummy key.
  console.warn("Warning: ARCJET_KEY environment variable is not set.");
  key = "arcjet_dummykey";
}

const aj = arcjet({
  // Get your site key from https://app.arcjet.com
  key,
  rules: [
    // Shield protects your app from common attacks e.g. SQL injection
    shield({ mode: "LIVE" }),
    // Create a bot detection rule
    detectBot({
      mode: "LIVE", // Blocks requests. Use "DRY_RUN" to log only
      // Block all bots
      allow: [],
    }),
    // Create a token bucket rate limit. Other algorithms are supported.
    slidingWindow({
      mode: "LIVE",
      interval: "10m", // 10 minute window
      max: 2, // Allow 2 requests per interval
    }),
  ],
});

export async function submitForm(_previousState: unknown, formData: FormData) {
  const rawEmail = formData.get("email");
  if (typeof rawEmail !== "string") {
    // This should never happen unless the form is tampered with
    throw new Response("Bad Request", { status: 400 });
  }

  const email = rawEmail.trim();
  if (!email) {
    return { message: "Email is required" };
  }

  // Access request data that Arcjet needs when you call `protect()` similarly
  // to `await headers()` and `await cookies()` in `next/headers`
  const req = await request();

  // The protect method returns a decision object that contains information
  // about the request.
  const decision = await aj.protect(req);
  console.log("Arcjet decision: ", decision);

  if (decision.isDenied()) {
    if (decision.reason.isBot()) {
      return { message: "Bots are not allowed" };
    } else if (decision.reason.isRateLimit()) {
      return { message: "Too many requests. Please try again later" };
    }

    return { message: "Forbidden" };
  }

  redirect("/submitted");
}
