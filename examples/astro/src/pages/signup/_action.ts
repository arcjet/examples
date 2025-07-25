import arcjet, { protectSignup, shield } from "arcjet:client";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";

// Add rules to the base Arcjet instance outside of the handler function
const aj = arcjet
  .withRule(
    // Arcjet's protectSignup rule is a combination of email validation, bot
    // protection and rate limiting. Each of these can also be used separately
    // on other routes e.g. rate limiting on a login route. See
    // https://docs.arcjet.com/get-started
    protectSignup({
      email: {
        mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
        // Block emails that are disposable, invalid, or have no MX records
        block: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
      },
      bots: {
        mode: "LIVE",
        // configured with a list of bots to allow from
        // https://arcjet.com/bot-list
        allow: [], // prevents bots from submitting the form
      },
      // It would be unusual for a form to be submitted more than 5 times in 10
      // minutes from the same IP address
      rateLimit: {
        // uses a sliding window rate limit
        mode: "LIVE",
        interval: "2m", // counts requests over a 10 minute sliding window
        max: 5, // allows 5 submissions within the window
      },
    }),
  )
  // You can chain multiple rules, so we'll include shield
  .withRule(
    // Shield detects suspicious behavior, such as SQL injection and cross-site
    // scripting attacks.
    shield({
      mode: "LIVE",
    }),
  );

// Astro schema for client-side validation of the form fields. Arcjet will do
// server-side validation as well because you can't trust the client.
// Client-side validation improves the UX by providing immediate feedback
// whereas server-side validation is necessary for security.
export const formSchema = z.object({
  email: z.coerce.string().email({
    message: "Please enter a valid email address.",
  }),
});

export const signupAction = defineAction({
  accept: "form",
  input: formSchema,
  async handler({ email }, { request }) {
    // The protect method returns a decision object that contains information
    // about the request.
    const decision = await aj.protect(request, {
      email,
    });

    console.log("Arcjet decision: ", decision);

    if (decision.isDenied()) {
      if (decision.reason.isEmail()) {
        let message: string;

        // These are specific errors to help the user, but will also reveal the
        // validation to a spammer.
        if (decision.reason.emailTypes.includes("INVALID")) {
          message = "email address format is invalid. Is there a typo?";
        } else if (decision.reason.emailTypes.includes("DISPOSABLE")) {
          message = "we do not allow disposable email addresses.";
        } else if (decision.reason.emailTypes.includes("NO_MX_RECORDS")) {
          message =
            "your email domain does not have an MX record. Is there a typo?";
        } else {
          // This is a catch all, but the above should be exhaustive based on the
          // configured rules.
          message = "invalid email.";
        }

        if (decision.ip.hasCountry()) {
          message += ` PS: Hello to you in ${decision.ip.countryName}!`;
        }

        throw new ActionError({
          code: "BAD_REQUEST",
          message,
        });
      } else if (decision.reason.isRateLimit()) {
        const reset = decision.reason.resetTime;

        if (reset === undefined) {
          throw new ActionError({
            code: "TOO_MANY_REQUESTS",
            message: "too many requests. Please try again later.",
          });
        }

        // Calculate number of seconds between reset Date and now
        const seconds = Math.floor((reset.getTime() - Date.now()) / 1000);
        const minutes = Math.ceil(seconds / 60);

        if (minutes > 1) {
          throw new ActionError({
            code: "TOO_MANY_REQUESTS",
            message: `too many requests. Please try again in ${minutes} minutes.`,
          });
        } else {
          throw new ActionError({
            code: "TOO_MANY_REQUESTS",
            message: `too many requests. Please try again in ${seconds} seconds.`,
          });
        }
      } else {
        throw new ActionError({
          code: "FORBIDDEN",
          message: `Forbidden`,
        });
      }
    } else if (decision.isErrored()) {
      console.error("Arcjet error:", decision.reason);
      if (decision.reason.message === "[unauthenticated] invalid key") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message:
            "Invalid Arcjet key. Is the ARCJET_KEY environment variable set?",
        });
      } else {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `Internal server error: ${decision.reason.message}`,
        });
      }
    }

    return {
      ok: true,
    };
  },
});
