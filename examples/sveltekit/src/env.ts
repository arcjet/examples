import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  ARCJET_KEY: {
    // Allow keyless builds; the server reports a missing key at runtime.
    schema: (value) => value,
    description: "Your Arcjet site key from https://console.arcjet.com",
  },
});
