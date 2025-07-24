import arcjet, { sensitiveInfo, shield } from "arcjet:client";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";

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

// Astro schema for client-side validation of the form fields. Arcjet will do
// server-side validation as well because you can't trust the client.
// Client-side validation improves the UX by providing immediate feedback
// whereas server-side validation is necessary for security.
export const formSchema = z.object({
  supportMessage: z.coerce
    .string()
    .min(5, { message: "Your message must be at least 5 characters." })
    .max(1000, {
      message:
        "Your message is too long. Please shorten it to 1000 characters.",
    }),
});

export const sensitiveInfoAction = defineAction({
  accept: "form",
  input: formSchema,
  async handler({ supportMessage }, { request }) {
    // The protect method returns a decision object that contains information
    // about the request.
    const decision = await aj.protect(request);

    console.log("Arcjet decision: ", decision);

    if (decision.isDenied()) {
      if (decision.reason.isSensitiveInfo()) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message:
            "We couldn't submit the form: please do not include credit card numbers in your message.",
        });
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

    console.log("Message submitted successfully:", supportMessage);

    return {
      ok: true,
    };
  },
});
