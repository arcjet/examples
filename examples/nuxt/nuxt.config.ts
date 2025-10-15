// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      title: "Arcjet Nuxt example app",
      htmlAttrs: {
        lang: "en",
      },
      bodyAttrs: {
        class: "layout",
      },
      link: [
        {
          rel: "icon",
          type: "image/x-icon",
          href: "/favicon.png",
          media: "(prefers-color-scheme: dark)",
        },
        {
          rel: "icon",
          type: "image/png",
          href: "/favicon-light.png",
          media: "(prefers-color-scheme: light)",
        },
      ],
    },
  },
  arcjet: {
    key: process.env.ARCJET_KEY,
  },
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@arcjet/nuxt"],
  // TODO: Enable strict type checking once the Arcjet Nuxt module typechecks.
  // typescript: { strict: true, typeCheck: true },
});
