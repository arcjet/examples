import { fixedWindow } from "@arcjet/fastify";
import type { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  const arcjet = fastify.arcjet.withRule(
    // Create a fixed window rate limit. Sliding window and token bucket are also
    // available.
    fixedWindow({
      mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
      max: 2, // max requests per window
      window: "60s", // window duration
    }),
  );

  fastify.get("/rate-limiting", async (request, reply) => {
    const decision = await arcjet.protect(request);

    fastify.log.info(`Arcjet: id = ${decision.id}`);
    fastify.log.info(
      `Arcjet: decision = ${decision.conclusion}, reason = ${decision.reason.type}`,
    );

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return reply
          .status(429)
          .header("Content-Type", "application/json")
          .send({ message: "Too many requests" });
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

    return reply
      .status(200)
      .header("Content-Type", "application/json")
      .send({ message: "Hello world" });
  });
}
