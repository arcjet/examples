import { fixedWindow, shield } from "@arcjet/react-router";
import { Form } from "react-router";
import { WhatNext } from "~/components/WhatNext";
import { arcjet } from "~/lib/arcjet";
import type { Route } from "./+types/rate-limiting";

// Add rules to the base Arcjet instance
const arcjetForRateLimiting = arcjet
  .withRule(
    // Shield detects suspicious behavior, such as SQL injection and cross-site
    // scripting attacks. We want to ru nit on every request
    shield({
      mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
    }),
  )
  .withRule(
    fixedWindow({
      mode: "LIVE",
      max: 2,
      window: "60s",
    }),
  );

export async function action(ctx: Route.ActionArgs) {
  // The protect method returns a decision object that contains information
  // about the request.
  const decision = await arcjetForRateLimiting.protect(ctx);

  console.log("Arcjet decision: ", decision);

  let message = "";
  let remaining = 0;

  if (decision.reason.isRateLimit()) {
    const reset = decision.reason.resetTime;
    remaining = decision.reason.remaining;

    if (reset === undefined) {
      message = "";
    } else {
      // Calculate number of seconds between reset Date and now
      const seconds = Math.floor((reset.getTime() - Date.now()) / 1000);
      const minutes = Math.ceil(seconds / 60);

      if (minutes > 1) {
        message = `Reset in ${minutes} minutes.`;
      } else {
        message = `Reset in ${seconds} seconds.`;
      }
    }
  }

  // If the decision is denied, return an error. You can inspect
  // the decision results to customize the response.
  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      // setResponseStatus(429);
      return `HTTP 429: Too many requests. ${message}`;
    } else {
      // setResponseStatus(403);
      return `Forbidden. ${message}`;
    }
  } else if (decision.isErrored()) {
    console.error("Arcjet error:", decision.reason);

    if (decision.reason.message === "[unauthenticated] invalid key") {
      // setResponseStatus(500);
      return "Invalid Arcjet key. Is the ARCJET_KEY environment variable set?";
    } else {
      // setResponseStatus(400);
      return `Internal server error: ${decision.reason.message}`;
    }
  }

  return `HTTP 200: OK. ${remaining} requests remaining. ${message}`;
}

export default function Component({ actionData }: Route.ComponentProps) {
  return (
    <main className="page">
      <div className="section">
        <h1 className="heading-primary">Arcjet rate limiting example</h1>
        <p className="typography--description">
          This page is protected by{" "}
          <a
            href="https://docs.arcjet.com/bot-protection/concepts"
            className="link"
          >
            Arcjet&apos;s rate limiting
          </a>
          .
        </p>
      </div>

      <hr className="divider" />

      <div className="section">
        <h2 className="heading-secondary">Try it</h2>
        <Form className="form" method="POST">
          <button type="submit" className="button-primary form-button">
            Push me
          </button>
        </Form>
        {actionData && <code className="codeblock">{actionData}</code>}
        <p>The limit is set to 2 requests every 60 seconds.</p>
        <p className="typography--subtitle">
          Rate limits can be{" "}
          <a
            href="https://docs.arcjet.com/reference/astro#ad-hoc-rules"
            className="link"
          >
            dynamically adjusted
          </a>{" "}
          e.g. to set a limit based on the authenticated user.
        </p>
      </div>

      <hr className="divider" />

      <div className="section">
        <h2 className="heading-secondary">See the code</h2>
        <p className="typography--subtitle">
          The{" "}
          <a
            href="https://github.com/arcjet/example-react-router/blob/main/app/routes/rate-limiting.tsx"
            target="_blank"
            rel="noreferrer"
            className="link"
          >
            server action
          </a>{" "}
          extends the{" "}
          <a
            href="https://github.com/arcjet/example-react-router/blob/main/app/lib/arcjet.ts"
            target="_blank"
            rel="noreferrer"
            className="link"
          >
            centralized Arcjet client
          </a>
          .
        </p>
      </div>

      <hr className="divider" />

      <WhatNext />
    </main>
  );
}
