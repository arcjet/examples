import { sensitiveInfo } from "@arcjet/fastify";
import type { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts";
import type { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  const arcjet = fastify.arcjet.withRule(
    // Deny requests containing credit card numbers
    sensitiveInfo({
      mode: "LIVE", // Will block requests, use "DRY_RUN" to log only
      deny: ["CREDIT_CARD_NUMBER"],
    }),
  );

  fastify.withTypeProvider<JsonSchemaToTsProvider>().post(
    "/sensitive-info",
    {
      schema: {
        body: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string" },
          },
        } as const,
      },
    },
    async (request, reply) => {
      const decision = await arcjet.protect(request);

      fastify.log.info(`Arcjet: id = ${decision.id}`);
      fastify.log.info(
        `Arcjet: decision = ${decision.conclusion}, reason = ${decision.reason.type}`,
      );

      if (decision.isDenied()) {
        if (decision.reason.isSensitiveInfo()) {
          // If the request was denied for any other reason, return a 403 Forbidden
          return reply
            .status(400)
            .header("Content-Type", "application/json")
            .send({
              message:
                "Please remove any credit card numbers from your message",
            });
        }

        // If the request was denied for any other reason, return a 403 Forbidden
        return reply
          .status(403)
          .header("Content-Type", "application/json")
          .send({ message: "Forbidden" });
      }

      if (decision.isErrored()) {
        // Fail open to prevent an Arcjet error from blocking all requests. You
        // may want to fail closed if this controller is very sensitive
        fastify.log.error(`Arcjet error: ${decision.reason.message}`);
      }

      return reply.status(200).header("Content-Type", "application/json").send({
        message: "No credit card number detected!",
        submission: request.body.message,
      });
    },
  );
}
