<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

# Arcjet example: Next.js server action form

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This is an example Next.js application demonstrating how to protect a Next.js
form which uses server action. It also uses [Arcjet
Nosecone](https://docs.arcjet.com/nosecone/quick-start) to configure security
headers in middleware.

## Features

- [Bot protection](https://docs.arcjet.com/bot-protection/quick-start) shows how
  the server action can be protected from automated clients.
- [Rate limiting](https://docs.arcjet.com/rate-limiting/quick-start) shows a
  rate limit configuration that limits the number of requests from a single IP.
- [Attack protection](https://docs.arcjet.com/shield/quick-start) demonstrates
  Arcjet Shield, which detects suspicious behavior, such as SQL injection and
  cross-site scripting attacks.

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

## Need help?

Check out [the docs](https://docs.arcjet.com/), [contact
support](https://docs.arcjet.com/support), or [join our Discord
server](https://arcjet.com/discord).
