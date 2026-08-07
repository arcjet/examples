<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

# Arcjet example: Next.js bot categories

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This is an example Next.js application demonstrating advanced Arcjet bot
detection. It shows how to build a bot allow list by category, by individual
bot, and by filtering an individual bot out of a category so it is still denied.

## Features

- [Bot protection](https://docs.arcjet.com/bot-protection/quick-start) allowing
  bots by [category](https://docs.arcjet.com/bot-protection/identifying-bots),
  by individual bot, and by filtering an individual bot out of a category.
- [Bot verification](https://docs.arcjet.com/bot-protection/reference#bot-verification)
  via [`@arcjet/inspect`](https://docs.arcjet.com/bot-protection/reference#bot-verification)
  to detect spoofed bots.

## Run locally

1. [Register for a free Arcjet account](https://app.arcjet.com).

2. Install dependencies:

```bash
npm ci
```

3. Rename `.env.local.example` to `.env.local` and add your Arcjet key.

4. Start the dev server

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Try it

The `/api/arcjet` route is protected by the bot detection rule configured in
[`lib/arcjet.ts`](./lib/arcjet.ts).

1. Request the API as `curl`, which belongs to `CATEGORY:TOOL` and is allowed:

   ```bash
   curl -v localhost:3000/api/arcjet
   ```

   The response headers show `curl` was detected and allowed because of
   `CATEGORY:TOOL`:

   ```txt
   x-arcjet-bot-allowed: CATEGORY:TOOL, CURL
   x-arcjet-bot-denied:
   ```

2. Change the `User-Agent` to Vercel's screenshot bot, which is allowed as an
   individual bot even though its category is not:

   ```bash
   curl -v -A "vercel-screenshot" localhost:3000/api/arcjet
   ```

   ```txt
   x-arcjet-bot-allowed: VERCEL_MONITOR_PREVIEW
   x-arcjet-bot-denied:
   ```

3. Finally, pretend to be Google's AdsBot. It is denied because we
   programmatically filtered it out of `CATEGORY:GOOGLE`, which expands the
   category into all its individual bots:

   ```bash
   curl -v -A "AdsBot-Google" localhost:3000/api/arcjet
   ```

   ```txt
   x-arcjet-bot-allowed:
   x-arcjet-bot-denied: GOOGLE_ADSBOT
   ```

## Need help?

Check out [the docs](https://docs.arcjet.com/), [contact
support](https://docs.arcjet.com/support), or [join our Discord
server](https://arcjet.com/discord).

## Contributing

All development for Arcjet examples is done in the
[`arcjet/examples` repository](https://github.com/arcjet/examples).

You are welcome to open an issue here or in
[`arcjet/examples`](https://github.com/arcjet/examples/issues) directly.
However, please direct all pull requests to
[`arcjet/examples`](https://github.com/arcjet/examples/pulls). Take a look at
our
[contributing guide](https://github.com/arcjet/examples/blob/main/CONTRIBUTING.md)
for more information.
