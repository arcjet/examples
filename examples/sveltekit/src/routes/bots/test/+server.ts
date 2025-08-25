import { detectBot, fixedWindow } from "@arcjet/sveltekit";
import { json, type RequestHandler } from "@sveltejs/kit";
import { arcjet } from "$lib/server/arcjet";

export const prerender = false;

// Add rules to the base Arcjet instance outside of the handler function
const aj = arcjet
  .withRule(
    detectBot({
      mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
      // configured with a list of bots to allow from
      // https://arcjet.com/bot-list
      allow: [], // blocks all automated clients
    }),
  )
  // You can chain multiple rules, so we'll include a rate limit
  .withRule(
    fixedWindow({
      mode: "LIVE",
      max: 100,
      window: "60s",
    }),
  );

export const GET: RequestHandler = async (event) => {
  // The protect method returns a decision object that contains information
  // about the request.
  const decision = await aj.protect(event);

  console.log("Arcjet decision: ", decision);

  // Use the IP analysis to customize the response based on the country
  if (decision.ip.hasCountry() && decision.ip.country === "JP") {
    return json({ message: "Konnichiwa!" });
  }

  // Always deny requests from VPNs
  if (decision.ip.isVpn()) {
    return json({ error: "VPNs are forbidden" }, { status: 403 });
  }

  // If the decision is denied, return an appropriate response. You can inspect
  // the decision results to customize the response.
  if (decision.isDenied()) {
    if (decision.reason.isBot()) {
      return json({ error: "Bots are forbidden" }, { status: 403 });
    }

    if (decision.reason.isRateLimit()) {
      return json({ error: "Too many requests" }, { status: 429 });
    }

    return json({ error: "Request denied" }, { status: 403 });
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
