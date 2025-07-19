import fastify from "fastify";
import plugin from "./app.ts";

const app = fastify({
  logger: true,
});

try {
  await plugin(app, {});
  await app.listen({ port: 3000 });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
