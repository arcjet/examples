<!-- markdownlint-disable MD033 MD041 -->
<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

[![Deploy with Vercel][vercel_button]][vercel_deploy]
&nbsp; &nbsp;
[![Deploy to Netlify][netlify_button]][netlify_deploy]

> [!NOTE]
>
> We don't yet have an official Arcjet SDK validated specifically for Nuxt.
> This example uses the `@arcjet/node` package with a small adapter
> located in [`src/lib/arcjet.ts`](./src/lib/arcjet.ts). Please report any
> issues you encounter to the
> [Arcjet examples monorepo](https://github.com/arcjet/examples/issues).

# Arcjet Nuxt example app

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This is an example Nuxt application demonstrating the use of multiple
features.

## Features

- [Signup form protection](https://example.arcjet.com/signup) uses Arcjet's
  server-side email verification configured to block disposable providers and
  ensure that the domain has a valid MX record. It also includes rate limiting
  and bot protection to prevent automated abuse.
- [Bot protection](https://example.arcjet.com/bots) shows how a page can be
  protected from automated clients.
- [Rate limiting](https://example.arcjet.com/rate-limiting) shows the use of
  different rate limit configurations depending on the authenticated user. A
  logged-in user can make more requests than an anonymous user.
- [Attack protection](https://example.arcjet.com/attack) demonstrates Arcjet
  Shield, which detects suspicious behavior, such as SQL injection and
  cross-site scripting attacks.
- [Sensitive info](https://example.arcjet.com/sensitive-info) protects against
  clients sending you sensitive information such as PII that you do not wish to
  handle.

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

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Need help?

Check out [the docs](https://docs.arcjet.com), [contact
support](https://docs.arcjet.com/support), or [join our Discord
server](https://arcjet.com/discord).

## Stack

- Nuxt: [Nuxt](https://nuxt.com)
- Security: [Arcjet](https://arcjet.com/)

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

[vercel_deploy]: https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Farcjet%2Fexample-nuxt&project-name=arcjet-nuxt-example&repository-name=arcjet-nuxt-example&developer-id=oac_1GEcKBuKBilVnjToj1QUwdb8&demo-title=Arcjet%Nuxt%20Example%20&demo-description=Example%20rate%20limiting%2C%20bot%20protection%2C%20email%20verification%20%26%20form%20protection.&demo-url=https%3A%2F%2Fgithub.com%2Farcjet%2Fexample-nuxt&demo-image=https%3A%2F%2Fapp.arcjet.com%2Fimg%2Fexample-apps%2Fvercel%2Fdemo-image.jpg&integration-ids=oac_1GEcKBuKBilVnjToj1QUwdb8&external-id=arcjet-js-example◊
[vercel_button]: https://vercel.com/button
[netlify_deploy]: https://app.netlify.com/start/deploy?repository=https://github.com/arcjet/example-nuxt
[netlify_button]: https://www.netlify.com/img/deploy/button.svg
