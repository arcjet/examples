import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter(),
      compilerOptions: {
        runes: true,
      },
      csrf: {
        trustedOrigins: [
          "http://localhost",
          "https://sveltekit.arcjet-examples.orb.local",
        ],
      },
      preprocess: vitePreprocess(),
    }),
  ],
});
