<!-- markdownlint-disable MD033 MD041 -->
<a href="https://arcjet.com" target="_arcjet-home">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://arcjet.com/logo/arcjet-dark-lockup-voyage-horizontal.svg">
    <img src="https://arcjet.com/logo/arcjet-light-lockup-voyage-horizontal.svg" alt="Arcjet Logo" height="128" width="auto">
  </picture>
</a>

# Arcjet example: Firebase functions

[Arcjet](https://arcjet.com) helps developers protect their apps in just a few
lines of code. Bot detection. Rate limiting. Email validation. Attack
protection. Data redaction. A developer-first approach to security.

This is an example Firebase functions application demonstrating how to protect a
website from abuse.

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
npm ci
```

3. Rename `example.secret.local` to `.secret.local` and add your Arcjet key.

4. Start the dev server

```sh
npm run dev
```

Firebase will print the local URL of both the emulator UI and the function
iteself. The function URL should end with `/arcjetExample`.

## Deploy to Firebase

1. [Register for a free Arcjet account](https://app.arcjet.com).

2. Install dependencies:

```sh
npm ci
```

3. Login to Firebase:

```sh
npx firebase login
```

4. Configure `ARCJET_KEY` secret in Firebase:

```sh
npx firebase functions:secrets:set ARCJET_KEY
```

5. Deploy to Firebase:

```sh
npm run deploy
```

Firebase will provide the URL of your deployed function which should end with
`/arcjetExample`.

## Try it

1. Open the deployed function URL in your browser and you'll see a "Hello world"
   response.
2. Reload the page 6 or so times within a minute and you should see "Rate limit exceeded."
3. Make a `curl` request to the function and you should see a "Bots denied" message.
4. Try running following `curl` command a couple times to simulate a spoofed bot

```sh
curl -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" <your function url>
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
