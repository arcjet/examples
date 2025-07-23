import path from "node:path";
import arcjetFastify, { type ArcjetFastify } from "@arcjet/fastify";
import fastifyAutoLoad from "@fastify/autoload";
import fastifyEnv from "@fastify/env";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    // Tells TypeScript about the `arcjet` property we've decorated the Fastify
    // instance with below.
    arcjet: ArcjetFastify<unknown>;
    // Tells TypeSscript about the `config` property provided by the
    // `@fastify/env`plugin below.
    config: {
      ARCJET_KEY?: string;
    };
  }
}

export default async function plugin(
  fastify: FastifyInstance,
  _options: unknown, // Must exist to match @fastify/cli's start command expectations
) {
  await fastify.register(fastifyEnv, {
    schema: {
      type: "object",
      properties: {
        ARCJET_KEY: {
          type: "string",
        },
      },
    },
  });

  if (!fastify.config.ARCJET_KEY) {
    fastify.log.warn(
      "Sign up for free at https://app.arcjet.com to get your key.",
    );
    throw new Error("Missing the ARCJET_KEY environment variable.");
  }

  // Decorate the Fastify instance with the Arcjet plugin so
  // it is always available at `fastify.arcjet`.
  await fastify.decorate(
    "arcjet",
    arcjetFastify({
      key: fastify.config.ARCJET_KEY,
      // Here is where you could configure rules that would be applied to all
      // of your routes that call `fastify.arcjet.protect()`. For this example,
      // we set specific rules in the route handlers instead.
      rules: [],
      // Configures Arcjet to use the Fastify logger
      log: fastify.log,
    }),
  );

  await fastify.register(fastifyAutoLoad, {
    dir: path.join(import.meta.dirname, "routes"),
    dirNameRoutePrefix: false,
  });
}
