import { fixedWindow, shield } from "@arcjet/sveltekit";
import { type Actions, fail } from "@sveltejs/kit";
import { arcjet } from "$lib/server/arcjet";

export const actions = {
  default: async (event) => {
    const aj = arcjet
      .withRule(
        shield({
          mode: "LIVE",
        }),
      )
      .withRule(
        fixedWindow({
          mode: "LIVE",
          max: 2,
          window: "60s",
        }),
      );

    const decision = await aj.protect(event);
    console.log("Arcjet decision: ", decision);

    let message = "";
    let remaining = 0;

    if (decision.reason.isRateLimit()) {
      const reset = decision.reason.resetTime;
      remaining = decision.reason.remaining;

      if (reset !== undefined) {
        const seconds = Math.floor((reset.getTime() - Date.now()) / 1000);
        const minutes = Math.ceil(seconds / 60);
        message =
          minutes > 1
            ? `Reset in ${minutes} minutes.`
            : `Reset in ${seconds} seconds.`;
      }
    }

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return fail(429, { error: `HTTP 429: Too many requests. ${message}` });
      }
      return fail(403, { error: `Forbidden. ${message}` });
    }

    if (decision.isErrored()) {
      console.error("Arcjet error:", decision.reason);
      if (decision.reason.message === "[unauthenticated] invalid key") {
        return fail(400, {
          error:
            "Invalid Arcjet key. Is the ARCJET_KEY environment variable set?",
        });
      }
      return fail(400, {
        error: `Internal server error: ${decision.reason.message}`,
      });
    }

    return {
      message: `HTTP 200: OK. ${remaining} requests remaining. ${message}`,
    };
  },
} satisfies Actions;
