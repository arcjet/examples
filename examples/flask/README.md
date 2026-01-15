<!-- markdownlint-disable MD033 MD041 -->
<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

# Arcjet example: Flask

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This is an example Flask application demonstrating how to protect a website
from abuse.

## Features

- [Bot protection](https://docs.arcjet.com/bot-protection/quick-start) shows how
  the site can be protected from automated clients.
- [Rate limiting](https://docs.arcjet.com/rate-limiting/quick-start) shows a
  rate limit configuration that limits the number of requests from a single IP.
- [Attack protection](https://docs.arcjet.com/shield/quick-start) demonstrates
  Arcjet Shield, which detects suspicious behavior, such as SQL injection and
  cross-site scripting attacks.

## Run locally

1. [Register for a free Arcjet account](https://app.arcjet.com).

2. Install dependencies:

```sh
uv sync
```

3. Rename `.env.example` to `.env` and add your Arcjet key.

4. Start the dev server

```sh
uv run --env-file=.env flask run --reload
```

5. Open [http://localhost:5000](http://localhost:5000) in your browser.

## Try it out

Here are some API routes to try out:

### Bot protection

The `/bots` route uses Arcjet Bot protection to block all automated clients
`curl` is considered an automated client by default, so you can test it with:

```sh
curl -v http://localhost:5000/bots
```

### Rate limiting

The `/rate-limiting` route uses a fixed window rate limit. Send 3 requests in quick
succession to see the rate limit in action:

```sh
curl -v http://localhost:5000/rate-limiting
```

### Attack protection

The `/attack` route uses Arcjet Shield to detect and block attacks, such as SQL
injection and cross-site scripting. To simulate an attack, send a request with
the special header:

```sh
curl -v http://localhost:5000/attack \
  -H "x-arcjet-suspicious: true"
```

After the 5th request, your IP will be blocked for 15 minutes. Suspicious
requests must meet a threshold before they are blocked to avoid false positives.

## Stack

- App: [Flask](https://flask.palletsprojects.com/)
- Security: [Arcjet](https://arcjet.com/)

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
