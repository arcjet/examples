import { sensitiveInfo, shield } from "@arcjet/react-router";
import { Form, redirect } from "react-router";
import { z } from "zod";
import { WhatNext } from "~/components/WhatNext";
import { arcjet } from "~/lib/arcjet";
import type { Route } from "./+types/sensitive-info";

// Add rules to the base Arcjet instance
const arcjetForSensitiveInfoDetection = arcjet
  .withRule(
    // Arcjet's protectSignup rule is a combination of email validation, bot
    // protection and rate limiting. Each of these can also be used separately
    // on other routes e.g. rate limiting on a login route. See
    // https://docs.arcjet.com/get-started
    sensitiveInfo({
      mode: "LIVE", // Will block requests, use "DRY_RUN" to log only
      deny: ["CREDIT_CARD_NUMBER", "EMAIL"], // Deny requests with credit card numbers
    }),
  )
  // You can chain multiple rules, so we'll include shield
  .withRule(
    // Shield detects suspicious behavior, such as SQL injection and cross-site
    // scripting attacks.
    shield({
      mode: "LIVE",
    }),
  );

// Zod for client-side validation of the form fields. Arcjet will do
// server-side validation as well because you can't trust the client.
// Client-side validation improves the UX by providing immediate feedback
// whereas server-side validation is necessary for security.
export const FormSchema = z.object({
  supportMessage: z.coerce
    .string()
    .min(5, { message: "Your message must be at least 5 characters." })
    .max(1000, {
      message:
        "Your message is too long. Please shorten it to 1000 characters.",
    }),
});

export async function action(ctx: Route.ActionArgs) {
  const formData = await ctx.request.formData();

  const parsed = FormSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return parsed.error.issues.at(0)?.message ?? "Invalid form data";
  }

  // The protect method returns a decision object that contains information
  // about the request.
  const decision = await arcjetForSensitiveInfoDetection.protect(ctx, {
    // Pass the message to be evaluated for sensitive info (locally)
    sensitiveInfoValue: parsed.data.supportMessage,
  });

  console.log("Arcjet decision: ", decision);

  if (decision.isDenied()) {
    if (decision.reason.isSensitiveInfo()) {
      return "We couldn't submit the form: please do not include credit card numbers in your message.";
    } else {
      return "Forbidden";
    }
  } else if (decision.isErrored()) {
    console.error("Arcjet error:", decision.reason);

    if (decision.reason.message === "[unauthenticated] invalid key") {
      return "Invalid Arcjet key. Is the ARCJET_KEY environment variable set?";
    } else {
      return `Internal server error: ${decision.reason.message}`;
    }
  }

  console.log("Message submitted successfully:", parsed.data.supportMessage);

  throw redirect("/sensitive-info/submitted");
}

export default function Component({ actionData }: Route.ComponentProps) {
  return (
    <main className="page">
      <div className="section">
        <h1 className="heading-primary">
          Arcjet sensitive info detection example
        </h1>
        <p className="typography-primary">
          This form uses{" "}
          <a
            href="https://docs.arcjet.com/sensitive-info/concepts"
            className="link"
          >
            Arcjet&apos;s sensitive info detection
          </a>{" "}
          feature which is configured to detect credit card numbers. It can be
          configured to detect other types of sensitive information and custom
          patterns.
        </p>
        <p className="typography-secondary">
          The request is analyzed entirely on your server so no sensitive
          information is sent to Arcjet.
        </p>
      </div>

      <hr className="divider" />

      <div className="section">
        <h2 className="heading-secondary">Try it</h2>

        <Form className="form" method="POST">
          <div className="form-field">
            <label className="form-label">
              Message
              <textarea
                placeholder="Please enter your message."
                className="form-textarea"
                name="supportMessage"
                defaultValue="I ordered a hat from your store and would like to request a refund. My credit card number is 4111111111111111"
              />
            </label>
            {actionData && <div className="form-error">{actionData}</div>}
          </div>
          <button type="submit" className="button-primary form-button">
            Submit
          </button>
        </Form>
      </div>
      <hr className="divider" />
      <div className="section">
        <h2 className="heading-secondary">See the code</h2>
        <p className="typography-secondary">
          The{" "}
          <a
            href="https://github.com/arcjet/example-react-router/blob/main/app/routes/sensitive-info.tsx"
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
