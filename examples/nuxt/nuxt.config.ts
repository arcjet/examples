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

  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  typescript: { strict: true, typeCheck: true },
});
