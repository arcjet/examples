import arcjet from "@arcjet/astro";
import node from "@astrojs/node";
// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
  adapter: node({
    mode: "standalone",
  }),
  integrations: [
    arcjet({
      rules: [
        // You can include one or more rules base rules. We don't include any here
        // so they can be set on each sub-page for the demo.
      ],
    }),
  ],
});
