import { protectSignup, shield } from "@arcjet/sveltekit";
import { type Actions, fail, redirect } from "@sveltejs/kit";
import { arcjet } from "$lib/server/arcjet";

export const actions = {
  default: async (event) => {
    const data = await event.request.formData();
    const email = String(data.get("email") ?? "");

    if (!email) {
      return fail(400, { error: "Please enter a valid email address.", email });
    }

    const aj = arcjet
      .withRule(
        protectSignup({
          email: {
            mode: "LIVE",
            block: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
          },
          bots: {
            mode: "LIVE",
            allow: [],
          },
          rateLimit: {
            mode: "LIVE",
            interval: "2m",
            max: 5,
          },
        }),
      )
      .withRule(
        shield({
          mode: "LIVE",
        }),
      );

    const decision = await aj.protect(event, { email });
    console.log("Arcjet decision: ", decision);

    if (decision.isDenied()) {
      if (decision.reason.isEmail()) {
        let message: string;
        if (decision.reason.emailTypes.includes("INVALID")) {
          message = "email address format is invalid. Is there a typo?";
        } else if (decision.reason.emailTypes.includes("DISPOSABLE")) {
          message = "we do not allow disposable email addresses.";
        } else if (decision.reason.emailTypes.includes("NO_MX_RECORDS")) {
          message =
            "your email domain does not have an MX record. Is there a typo?";
        } else {
          message = "invalid email.";
        }

        if (decision.ip.hasCountry()) {
          message += ` PS: Hello to you in ${decision.ip.countryName}!`;
        }

        return fail(400, { error: message, email });
      } else if (decision.reason.isRateLimit()) {
        const reset = decision.reason.resetTime;
        if (reset === undefined) {
          return fail(429, {
            error: "too many requests. Please try again later.",
            email,
          });
        }
        const seconds = Math.floor((reset.getTime() - Date.now()) / 1000);
        const minutes = Math.ceil(seconds / 60);
        const error =
          minutes > 1
            ? `too many requests. Please try again in ${minutes} minutes.`
            : `too many requests. Please try again in ${seconds} seconds.`;
        return fail(429, { error, email });
      } else {
        return fail(403, { error: "Forbidden", email });
      }
    }

    if (decision.isErrored()) {
      console.error("Arcjet error:", decision.reason);
      if (decision.reason.message === "[unauthenticated] invalid key") {
        return fail(400, {
          error:
            "Invalid Arcjet key. Is the ARCJET_KEY environment variable set?",
          email,
        });
      }
      return fail(400, {
        error: `Internal server error: ${decision.reason.message}`,
        email,
      });
    }

    redirect(303, "/signup/submitted");
  },
} satisfies Actions;
