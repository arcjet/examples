<!-- markdownlint-disable MD033 MD041 -->
<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

# Arcjet example: Express.js with Newman tests

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This example shows how to test that your [Express.js](https://expressjs.com/)
routes protected by Arcjet behave as expected. It uses
[Newman](https://learning.postman.com/docs/collections/using-newman-cli/command-line-integration-with-newman/)
to run [Postman](https://www.postman.com/) collections against a running server,
driven by the Node.js built-in test runner.

## Features

- [Rate limiting](https://docs.arcjet.com/rate-limiting/quick-start) protects
  two routes with different fixed-window limits so you can assert both the
  allowed and rate-limited responses.
- [Bot protection](https://docs.arcjet.com/bot-protection/quick-start) protects
  a route that blocks all bots, asserted with a bot-like `User-Agent`.
- Automated tests with `node --test` and Newman verify the Arcjet decisions for
  each route using the Postman collections in `tests/`.

Each route applies its Arcjet rule inline with `.withRule()` so the sample stays
self-contained. In a real app you should define static rules once, outside the
request handler, for better performance.

## Run locally

1. [Register for a free Arcjet account](https://app.arcjet.com).

2. Install dependencies:

   ```bash
   npm ci
   ```

3. Rename `.env.local.example` to `.env.local` and add your Arcjet key.

4. Start the server:

   ```bash
   npm start
   ```

5. In another terminal, run the included Postman collections as tests:

   ```bash
   npx newman run tests/low-rate-limit.json
   npx newman run tests/high-rate-limit.json -n 51
   npx newman run tests/bots.json
   ```

6. You can also stop your server and run the collections as part of your test
   suite. The suite starts and stops the server for you:

   ```bash
   npm test
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
