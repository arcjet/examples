import { protectSignup } from "@arcjet/fastify";
import { isMissingUserAgent } from "@arcjet/inspect";
import type { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts";
import type { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  const arcjet = fastify.arcjet.withRule(
    protectSignup({
      email: {
        mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
        // Block emails that are disposable, invalid, or have no MX records
        deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
      },
      bots: {
        mode: "LIVE",
        // configured with a list of bots to allow from
        // https://arcjet.com/bot-list
        allow: ["CURL"], // prevents bots from submitting the form, but allow curl for this example
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
  );

  fastify.withTypeProvider<JsonSchemaToTsProvider>().post(
    "/signup",
    {
      schema: {
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string" },
          },
        } as const,
      },
    },
    async (request, reply) => {
      const decision = await arcjet.protect(request, {
        email: request.body.email,
      });

      fastify.log.info(`Arcjet: id = ${decision.id}`);
      fastify.log.info(
        `Arcjet: decision = ${decision.conclusion}, reason = ${decision.reason.type}`,
      );

      if (decision.isDenied()) {
        if (decision.reason.isBot()) {
          return reply
            .status(403)
            .header("Content-Type", "application/json")
            .send({ message: "No bots allowed" });
        }
        if (decision.reason.isRateLimit()) {
          return reply
            .status(429)
            .header("Content-Type", "application/json")
            .send({ message: "Too many requests" });
        }

        if (decision.reason.isEmail()) {
          fastify.log.info(
            `Arcjet: email error = ${decision.reason.emailTypes}`,
          );

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

          return reply
            .status(400)
            .header("Content-Type", "application/json")
            .send({ message: `Error: ${message}` });
        }

        // If the request was denied for any other reason, return a 403 Forbidden
        return reply
          .status(403)
          .header("Content-Type", "application/json")
          .send({ message: "Forbidden" });
      }

      if (decision.results.some(isMissingUserAgent)) {
        // Requests without User-Agent headers can not be identified as any
        // particular bot and will be marked as an errored decision. Most
        // legitimate clients always send this header, so we recommend blocking
        // requests without it.
        fastify.log.warn("User-Agent header is missing");
        return reply
          .status(400)
          .header("Content-Type", "application/json")
          .send({ message: "Bad request" });
      }

      if (decision.isErrored()) {
        // Fail open to prevent an Arcjet error from blocking all requests. You
        // may want to fail closed if this controller is very sensitive
        fastify.log.error(`Arcjet error: ${decision.reason.message}`);
      }

      fastify.log.info(
        `Signup attempt for ${request.body.email} was successful.`,
      );

      return reply
        .status(200)
        .header("Content-Type", "application/json")
        .send({ message: `Hello ${request.body.email}!` });
    },
  );
}
