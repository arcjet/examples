import { shield } from "@arcjet/node";

// Add rules to the base Arcjet instance outside of the handler function
const aj = arcjet.withRule(
  // Shield detects suspicious behavior, such as SQL injection and cross-site
  // scripting attacks.
  shield({
    mode: "LIVE",
  }),
);

export default defineEventHandler(async (event) => {
  // The protect method returns a decision object that contains information
  // about the request.
  const decision = await aj.protect(event.node.req);

  console.log("Arcjet decision: ", decision);

  // If the decision is denied, return a 403 Forbidden response. You can inspect
  // the decision results to customize the response.
  if (decision.isDenied()) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  } else if (decision.isErrored()) {
    console.error("Arcjet error:", decision.reason);
    if (decision.reason.message === "[unauthenticated] invalid key") {
      return Response.json(
        {
          message:
            "Invalid Arcjet key. Is the ARCJET_KEY environment variable set?",
        },
        { status: 500 },
      );
    } else {
      return Response.json(
        { v: `Internal server error: ${decision.reason.message}` },
        { status: 500 },
      );
    }
  }

  return Response.json({ message: "Hello world" });
});
