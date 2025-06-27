// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import arcjet from "@arcjet/astro";

export default defineConfig({
  adapter: node({
    mode: "standalone",
  }),
  integrations: [
    arcjet({
      // We specify a custom fingerprint so we can dynamically build it within each
      // demo route.
      characteristics: ["fingerprint"],
      rules: [
        // You can include one or more rules base rules. We don't include any here
        // so they can be set on each sub-page for the demo.
      ],
    }),
  ],
});
