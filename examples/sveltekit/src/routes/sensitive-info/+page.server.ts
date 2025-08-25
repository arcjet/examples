import { sensitiveInfo, shield } from "@arcjet/sveltekit";
import { type Actions, fail, redirect } from "@sveltejs/kit";
import { arcjet } from "$lib/server/arcjet";

export const actions = {
  default: async (event) => {
    const data = await event.request.formData();
    const supportMessage = String(data.get("supportMessage") ?? "");

    // Basic server-side validation to mirror Astro example
    if (supportMessage.length < 5) {
      return fail(400, {
        error: "Your message must be at least 5 characters.",
        supportMessage,
      });
    }
    if (supportMessage.length > 1000) {
      return fail(400, {
        error:
          "Your message is too long. Please shorten it to 1000 characters.",
        supportMessage,
      });
    }

    const aj = arcjet
      .withRule(
        sensitiveInfo({
          mode: "LIVE",
          deny: ["CREDIT_CARD_NUMBER", "EMAIL"],
        }),
      )
      .withRule(
        shield({
          mode: "LIVE",
        }),
      );

    const decision = await aj.protect(event);
    console.log("Arcjet decision: ", decision);

    if (decision.isDenied()) {
      if (decision.reason.isSensitiveInfo()) {
        return fail(400, {
          error:
            "We couldn't submit the form: please do not include credit card numbers in your message.",
          supportMessage,
        });
      }
      return fail(403, { error: "Forbidden", supportMessage });
    }

    if (decision.isErrored()) {
      console.error("Arcjet error:", decision.reason);
      if (decision.reason.message === "[unauthenticated] invalid key") {
        return fail(400, {
          error:
            "Invalid Arcjet key. Is the ARCJET_KEY environment variable set?",
          supportMessage,
        });
      }
      return fail(400, {
        error: `Internal server error: ${decision.reason.message}`,
        supportMessage,
      });
    }

    redirect(303, "/sensitive-info/submitted");
  },
} satisfies Actions;
