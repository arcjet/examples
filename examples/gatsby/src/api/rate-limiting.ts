// @ts-expect-error: TS1479: TS emits ESM/CJS error, which Gatsby solves.
import arcjet, { fixedWindow, shield } from "@arcjet/node";
import type { GatsbyFunctionRequest, GatsbyFunctionResponse } from "gatsby";

// Get your Arcjet key at <https://app.arcjet.com>.
// Set it as an environment variable instead of hard coding it.
let arcjetKey = process.env.ARCJET_KEY;
if (!arcjetKey) {
  console.warn(
    "ARCJET_KEY environment variable is required. Sign up for your Arcjet key at https://app.arcjet.com",
  );
  // Typically you would throw an error here, but for the sake of this example,
  // we will just set an empty key and Arcjet will show errors about the
  // missing key.
  arcjetKey = "";
}

const aj = arcjet({
  key: arcjetKey,
  rules: [
    shield({
      mode: "LIVE",
    }),
    fixedWindow({
      mode: "LIVE",
      max: 2,
      window: "60s",
    }),
  ],
});

export default async function handler(
  req: GatsbyFunctionRequest,
  res: GatsbyFunctionResponse,
) {
  const decision = await aj.protect(req);

  console.log("Arcjet decision", decision);

  let message = "";

  if (decision.reason.isRateLimit()) {
    const reset = decision.reason.resetTime;
    const remaining = decision.reason.remaining;

    if (reset === undefined) {
      message = "";
    } else {
      const seconds = Math.floor((reset.getTime() - Date.now()) / 1000);
      const minutes = Math.ceil(seconds / 60);

      if (minutes > 1) {
        message = `Reset in ${minutes} minutes.`;
      } else {
        message = `Reset in ${seconds} seconds.`;
      }
    }

    if (decision.isDenied()) {
      return res.status(429).json({
        error: `HTTP 429: Too many requests. ${message}`,
      });
    }

    return res.json({
      message: `HTTP 200: OK. ${remaining} requests remaining. ${message}`,
    });
  }

  if (decision.isErrored()) {
    console.error("Encountered Arcjet Error", decision.reason);

    if (decision.reason.message === "[unauthenticated] invalid key") {
      return res.status(500).json({
        error:
          "Invalid Arcjet key. Is the ARCJET_KEY environment variable set?",
      });
    }

    return res.status(500).json({
      error: `Internal server error: ${decision.reason.message}`,
    });
  }

  if (decision.isDenied()) {
    return res.status(403).json({ error: `Forbidden. ${message}` });
  }

  return res.json({ message: "HTTP 200: OK." });
}
