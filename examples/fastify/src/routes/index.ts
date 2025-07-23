import type { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  fastify.get("/", async (_request, reply) => {
    return reply
      .status(200)
      .header("Content-Type", "text/plain")
      .send(`Hello world. See the README for instructions.`);
  });
}
