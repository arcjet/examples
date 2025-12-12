"use server";

import arcjet, {
  detectBot,
  request,
  shield,
  slidingWindow,
} from "@arcjet/next";
import { redirect } from "next/navigation";

const aj = arcjet({
  // Get your site key from https://app.arcjet.com
  key: process.env.ARCJET_KEY,
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

export async function submitForm(prevState: any, formData: FormData) {
  const email = formData.get("email")?.toString().trim();

  if (!email || email === "") {
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
    } else {
      return { message: "Forbidden" };
    }
  }

  redirect("/submitted");
}
