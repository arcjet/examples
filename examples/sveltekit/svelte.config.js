import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    runes: true,
  },
  kit: {
    adapter: adapter(),
    csrf: {
      trustedOrigins: [
        "http://localhost",
        "https://sveltekit.arcjet-examples.orb.local",
      ],
    },
  },
  preprocess: vitePreprocess(),
};

export default config;
