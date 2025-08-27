import { shield } from "@arcjet/sveltekit";
import { json, type RequestHandler } from "@sveltejs/kit";
import { arcjet } from "$lib/server/arcjet";

// Add rules to the base Arcjet instance outside of the handler function
const aj = arcjet.withRule(
  // Shield detects suspicious behavior, such as SQL injection and cross-site
  // scripting attacks.
  shield({
    mode: "LIVE",
  }),
);

export const GET: RequestHandler = async (event) => {
  // The protect method returns a decision object that contains information
  // about the request.
  const decision = await aj.protect(event);

  console.log("Arcjet decision: ", decision);

  // If the decision is denied, return a 403 Forbidden response. You can
  // inspect the decision results to customize the response.
  if (decision.isDenied()) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  if (decision.isErrored()) {
    console.error("Arcjet error:", decision.reason);
    if (decision.reason.message === "[unauthenticated] invalid key") {
      return json(
        {
          message:
            "Invalid Arcjet key. Is the ARCJET_KEY environment variable set?",
        },
        { status: 500 },
      );
    }

    return json(
      { message: `Internal server error: ${decision.reason.message}` },
      { status: 500 },
    );
  }

  return json({ message: "Hello world" });
};
