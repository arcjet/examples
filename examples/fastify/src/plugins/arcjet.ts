import arcjetFastify, { type ArcjetFastify } from "@arcjet/fastify";
import fastifyPlugin from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    arcjet: ArcjetFastify<unknown>; // TODO: How could we dynamically type this based on the options passed in?
  }
}

export default fastifyPlugin<Parameters<typeof arcjetFastify>[0]>(
  async (fastify, options) => {
    // Decorate the Fastify instance with the Arcjet plugin so
    // it is always available at `fastify.arcjet`.
    await fastify.decorate(
      "arcjet",
      arcjetFastify({
        // Configure Arcjet to use the Fastify logger
        log: fastify.log,
        ...options,
      }),
    );
  },
  {
    name: "arcjet",
    fastify: "5.x",
  },
);
