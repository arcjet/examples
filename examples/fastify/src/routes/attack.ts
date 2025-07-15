import { shield } from "@arcjet/fastify";
import type { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  const arcjet = fastify.arcjet.withRule(
    // Configures Arcjet Shield. Shield protects
    // against common attacks e.g. SQL injection, XSS, etc.
    shield({ mode: "LIVE" }),
  );

  fastify.get("/attack", async (request, reply) => {
    const decision = await arcjet.protect(request);

    fastify.log.info(`Arcjet: id = ${decision.id}`);
    fastify.log.info(
      `Arcjet: decision = ${decision.conclusion}, reason = ${decision.reason.type}`,
    );

    if (decision.isDenied()) {
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
