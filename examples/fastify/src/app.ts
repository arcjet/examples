import path from "node:path";
import fastifyAutoLoad from "@fastify/autoload";
import fastifyEnv from "@fastify/env";
import type { FastifyInstance } from "fastify";
import arcjetPlugin from "./plugins/arcjet.ts";

declare module "fastify" {
  interface FastifyInstance {
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

  await fastify.register(arcjetPlugin, {
    key: fastify.config.ARCJET_KEY,
    rules: [],
  });

  await fastify.register(fastifyAutoLoad, {
    dir: path.join(import.meta.dirname, "routes"),
    dirNameRoutePrefix: false,
  });
}
