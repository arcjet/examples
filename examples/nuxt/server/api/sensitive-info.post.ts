import { sensitiveInfo, shield } from "#arcjet";
import { z } from "zod";

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

// Zod schema for client-side validation of the form fields. Arcjet will do
// server-side validation as well because you can't trust the client.
// Client-side validation improves the UX by providing immediate feedback
// whereas server-side validation is necessary for security.
export const FormSchema = z.object({
  supportMessage: z.coerce
    .string()
    .min(5, { message: "Your message must be at least 5 characters." })
    .max(1000, {
      message:
        "Your message is too long. Please shorten it to 1000 characters.",
    }),
});

export default defineEventHandler(async (event) => {
  const formData = await readFormData(event);

  const parsed = FormSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    throw createError({
      message: parsed.error.issues.at(0)?.message ?? "Invalid form data",
      statusCode: 400,
    });
  }

  // The protect method returns a decision object that contains information
  // about the request.
  const decision = await aj.protect(event, {
    // Pass the message to be evaluated for sensitive info (locally)
    sensitiveInfoValue: parsed.data.supportMessage,
  });

  console.log("Arcjet decision: ", decision);

  if (decision.isDenied()) {
    if (decision.reason.isSensitiveInfo()) {
      throw createError({
        message:
          "We couldn't submit the form: please do not include credit card numbers in your message.",
        statusCode: 400,
      });
    }

    throw createError({
      message: "Forbidden",
      statusCode: 403,
    });
  }

  if (decision.isErrored()) {
    console.error("Arcjet error:", decision.reason);
    if (decision.reason.message === "[unauthenticated] invalid key") {
      throw createError({
        message:
          "Invalid Arcjet key. Is the ARCJET_KEY environment variable set?",
        statusCode: 400,
      });
    }

    throw createError({
      message: `Internal server error: ${decision.reason.message}`,
      statusCode: 400,
    });
  }

  console.log("Message submitted successfully:", parsed.data.supportMessage);
});
