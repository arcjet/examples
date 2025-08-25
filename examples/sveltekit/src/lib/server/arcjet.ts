import arcjetSvelteKit from "@arcjet/sveltekit";
import { env } from "$env/dynamic/private";

let arcjetKey = env.ARCJET_KEY;
if (!arcjetKey) {
  console.warn(
    "ARCJET_KEY environment variable is required. Sign up for your Arcjet key at https://app.arcjet.com",
  );
  // Typically you would throw an error here, but for the sake of this example,
  // we will just set an empty key and Arcjet will show errors about the
  // missing key.
  arcjetKey = "";
}

export const arcjet = arcjetSvelteKit({
  key: arcjetKey,
  // Here is where you could configure rules that would be applied to all
  // of your routes that call `fastify.arcjet.protect()`. For this example,
  // we set specific rules in the route handlers instead.
  rules: [],
});
