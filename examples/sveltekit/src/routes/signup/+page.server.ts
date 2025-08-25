import { protectSignup, shield } from "@arcjet/sveltekit";
import { type Actions, fail, redirect } from "@sveltejs/kit";
import z from "zod";
import { arcjet } from "$lib/server/arcjet";

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

// Zod schema for validation of the form fields.
const FormSchema = z.object({
  email: z.coerce.string(),
});

export const actions = {
  default: async (event) => {
    const formData = await event.request.formData();
    const validated = FormSchema.safeParse(Object.fromEntries(formData));

    if (!validated.success) {
      return fail(400, {
        error: validated.error.issues[0].message,
      });
    }

    const email = validated.data.email;

    // The protect method returns a decision object that contains information
    // about the request.
    const decision = await aj.protect(event, { email });

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

        return fail(400, { error: message });
      }

      if (decision.reason.isRateLimit()) {
        const reset = decision.reason.resetTime;
        if (reset === undefined) {
          return fail(429, {
            error: "too many requests. Please try again later.",
          });
        }

        // Calculate number of seconds between reset Date and now
        const seconds = Math.floor((reset.getTime() - Date.now()) / 1000);
        const minutes = Math.ceil(seconds / 60);
        const error =
          minutes > 1
            ? `too many requests. Please try again in ${minutes} minutes.`
            : `too many requests. Please try again in ${seconds} seconds.`;
        return fail(429, { error, email });
      }

      return fail(403, { error: "Forbidden", email });
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
