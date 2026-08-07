<!-- markdownlint-disable MD033 MD041 -->
<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

# Arcjet example: React Router middleware

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This is an example React Router application demonstrating how to protect an app
using [React Router v8
middleware](https://reactrouter.com/how-to/middleware). A root `middleware`
function runs `arcjet.protect()` once per request and stashes the resulting
decision in a typed context, which loaders and actions then read to decide
whether to allow the request.

## Features

- [Rate limiting](https://docs.arcjet.com/rate-limiting/quick-start) shows a
  fixed window rate limit that blocks a client after too many requests.
- [Attack protection](https://docs.arcjet.com/shield/quick-start) demonstrates
  Arcjet Shield, which detects suspicious behavior, such as SQL injection and
  cross-site scripting attacks.

The middleware deliberately omits Arcjet's
[sensitive info](https://docs.arcjet.com/sensitive-info/quick-start) rule
because middleware should not read the request body. See the
[`react-router`](../react-router) example for a non-middleware app that uses
`sensitiveInfo`.

## Run locally

1. [Register for a free Arcjet account](https://app.arcjet.com).

2. Install dependencies:

```bash
npm ci
```

3. Rename `.env.example` to `.env` and add your Arcjet key.

4. Start the dev server

```bash
npm run dev
```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

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
