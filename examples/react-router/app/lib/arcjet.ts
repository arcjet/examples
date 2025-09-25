import { env as processEnv } from "node:process";
import arcjetReactRouter from "@arcjet/react-router";

// Get your Arcjet key at <https://app.arcjet.com>.
// Set it as an environment variable instead of hard coding it.
let arcjetKey = processEnv.ARCJET_KEY;
if (!arcjetKey) {
  console.warn(
    "ARCJET_KEY environment variable is required. Sign up for your Arcjet key at https://app.arcjet.com",
  );
  // Typically you would throw an error here, but for the sake of this example,
  // we will just set an empty key and Arcjet will show errors about the
  // missing key.
  arcjetKey = "";
}

export const arcjet = arcjetReactRouter({
  key: arcjetKey,
  // Here is where you could configure rules that would be applied to all
  // of your routes that call `arcjet.protect()`. For this example,
  // we set specific rules in the route handlers instead.
  rules: [],
});
