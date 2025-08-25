import { sensitiveInfo, shield } from "@arcjet/sveltekit";
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
    sensitiveInfo({
      mode: "LIVE", // Will block requests, use "DRY_RUN" to log only
      deny: ["CREDIT_CARD_NUMBER", "EMAIL"], // Deny requests with credit card numbers
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
  supportMessage: z.coerce
    .string()
    .min(5, { message: "Your message must be at least 5 characters." })
    .max(1000, {
      message:
        "Your message is too long. Please shorten it to 1000 characters.",
    }),
});

export const actions = {
  default: async (event) => {
    // NOTE: We have to clone the request here otherwise @arcjet/sveltekit will
    //       be unable to read the body for sensitive info detection.
    const formData = await event.request.clone().formData();

    const validated = FormSchema.safeParse(Object.fromEntries(formData));

    if (!validated.success) {
      return fail(400, {
        error: validated.error.issues[0].message,
      });
    }

    // The protect method returns a decision object that contain information
    // about the request.
    const decision = await aj.protect(event);

    console.log("Arcjet decision: ", decision);

    if (decision.isDenied()) {
      if (decision.reason.isSensitiveInfo()) {
        return fail(400, {
          error:
            "We couldn't submit the form: please do not include credit card numbers in your message.",
        });
      }
      return fail(403, { error: "Forbidden" });
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

    redirect(303, "/sensitive-info/submitted");
  },
} satisfies Actions;
