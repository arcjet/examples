import { fixedWindow, shield } from "@arcjet/node";

// Add rules to the base Arcjet instance outside of the handler function
const aj = arcjet
  .withRule(
    // Shield detects suspicious behavior, such as SQL injection and cross-site
    // scripting attacks. We want to ru nit on every request
    shield({
      mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
    }),
  )
  .withRule(
    fixedWindow({
      mode: "LIVE",
      max: 2,
      window: "60s",
    }),
  );

export default defineEventHandler(async (event) => {
  // The protect method returns a decision object that contains information
  // about the request.
  const decision = await aj.protect(event.node.req);

  console.log("Arcjet decision: ", decision);

  let message = "";
  let remaining = 0;

  if (decision.reason.isRateLimit()) {
    const reset = decision.reason.resetTime;
    remaining = decision.reason.remaining;

    if (reset === undefined) {
      message = "";
    } else {
      // Calculate number of seconds between reset Date and now
      const seconds = Math.floor((reset.getTime() - Date.now()) / 1000);
      const minutes = Math.ceil(seconds / 60);

      if (minutes > 1) {
        message = `Reset in ${minutes} minutes.`;
      } else {
        message = `Reset in ${seconds} seconds.`;
      }
    }
  }

  // If the decision is denied, return an error. You can inspect
  // the decision results to customize the response.
  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      throw createError({
        message: `HTTP 429: Too many requests. ${message}`,
        statusCode: 429,
      });
    }

    throw createError({
      message: `Forbidden. ${message}`,
      statusCode: 403,
    });
  }

  if (decision.isErrored()) {
    console.error("Arcjet error:", decision.reason);

    if (decision.reason.message === "[unauthenticated] invalid key") {
      throw createError({
        message:
          "Invalid Arcjet key. Is the ARCJET_KEY environment variable set?",
        statusCode: 500,
      });
    }

    throw createError({
      message: `Internal server error: ${decision.reason.message}`,
      statusCode: 500,
    });
  }

  return `HTTP 200: OK. ${remaining} requests remaining. ${message}`;
});
