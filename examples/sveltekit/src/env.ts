import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  ARCJET_KEY: {
    description: "Your Arcjet site key from https://console.arcjet.com",
  },
});
