<!-- markdownlint-disable MD033 MD041 -->
<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

# Arcjet Fastify example app

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This is an example Fastify application demonstrating the use of multiple
features.

## Features

- Bot protection shows how a page can be protected from automated clients.
- Rate limiting shows the use of different rate limit configurations depending
  on the authenticated user. A logged-in user can make more requests than an
  anonymous user.
- Signup form protection uses Arcjet's server-side email verification configured
  to block disposable providers and ensure that the domain has a valid MX
  record. It also includes rate limiting and bot protection to prevent automated
  abuse.
- Sensitive info protects against clients sending you sensitive information such
  as PII that you do not wish to handle.
- Attack protection demonstrates Arcjet Shield, which detects suspicious
  behavior such as SQL injection and cross-site scripting attacks.

## Deploy it now

[![Deploy with Vercel][vercel_button]][vercel_deploy]
&nbsp; &nbsp;
[![Deploy to Netlify][netlify_button]][netlify_deploy]

## Run locally

1. [Register for a free Arcjet account](https://app.arcjet.com).

2. Install dependencies:

```sh
npm ci
```

3. Rename `.env.example` to `.env` and add your Arcjet key.

4. Start the dev server

```sh
# Node.js 24.3+
npm run dev
```

> [!TIP] For older versions of Node.js or if you encounter this error:
>
> > Unknown file extension ".ts"
>
> Use this [`tsx`](https://www.npmjs.com/package/tsx)-based command instead:
>
> ```sh
> npm run dev-tsx
> ```

## Try it out

Fastify is a server-side framework, so you won't see much in the browser. Here
are some API routes to try:

### Bot protection

The `/bots` route uses a guard to protect the controller. All automated clients
will receive a 403 response. `curl` is considered an automated client by
default, so you can test it with:

```sh
curl -v http://localhost:3000/bots
```

### Rate limiting

The `/rate-limiting` route uses a fixed window rate limit. Send 3 requests in quick
succession to see the rate limit in action:

```sh
curl -v http://localhost:3000/rate-limiting
```

### Signup form protection

The `/signup` route uses Arcjet's signup form protection which combines bot
protection, rate limiting, and email verification. To test it, send a POST
request with different email addresses to test:

```sh
curl -v http://localhost:3000/signup \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"email":"invalid.@arcjet.com"}'
```

Try these emails to see how it works:

- `invalid.@arcjet` – is an invalid email address.
- `test@0zc7eznv3rsiswlohu.tk` – is from a disposable email provider.
- `nonexistent@arcjet.ai` – is a valid email address & domain, but has no MX
  records.

### Sensitive info

The `/sensitive-info` route uses a guard to protect the controller. It will
block requests containing credit card numbers:

```sh
curl -v http://localhost:3000/sensitive-info \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"message":"Hello my credit card is 4111111111111111"}'
```

### Attack protection

The `/attack` route uses Arcjet Shield to detect and block attacks, such as SQL
injection and cross-site scripting. To simulate an attack, send a request with
the special header:

```sh
curl -v http://localhost:3000/attack \
  -H "x-arcjet-suspicious: true"
```

After the 5th request, your IP will be blocked for 15 minutes. Suspicious
requests must meet a threshold before they are blocked to avoid false positives.

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

[vercel_deploy]: https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Farcjet%2Fexample-fastify&project-name=arcjet-example&repository-name=arcjet-example&developer-id=oac_1GEcKBuKBilVnjToj1QUwdb8&demo-title=Arcjet%20Example%20&demo-description=Example%20rate%20limiting%2C%20bot%20protection%2C%20email%20verification%20%26%20form%20protection.&demo-url=https%3A%2F%2Fgithub.com%2Farcjet%2Fexample-fastify&demo-image=https%3A%2F%2Fapp.arcjet.com%2Fimg%2Fexample-apps%2Fvercel%2Fdemo-image.jpg&integration-ids=oac_1GEcKBuKBilVnjToj1QUwdb8&external-id=example-fastify
[vercel_button]: https://vercel.com/button
[netlify_deploy]: https://app.netlify.com/start/deploy?repository=https://github.com/arcjet/example-fastify
[netlify_button]: https://www.netlify.com/img/deploy/button.svg
