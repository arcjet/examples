import { arcjet } from "@/lib/arcjet";
import { request } from "@arcjet/next";
import { isSpoofedBot } from "@arcjet/inspect";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Bot protection example",
  description: "An example of Arcjet's bot protection for Next.js.",
};

export default async function IndexPage() {
  // Access the request object so Arcjet can analyze it
  const req = await request();

  // Call Arcjet protect
  const decision = await arcjet.protect(req);
  console.log("Arcjet decision:", decision);

  // Bots not in the allow list will be blocked
  if (decision.isDenied()) {
    console.log("Bot detected and blocked!");

    // For now in Next.js server components `throw notFound();` is the most
    // convenient way to deny access to a page. In the future the currently
    // experimental `throw forbidden()` could be used instead. See:
    // - https://nextjs.org/docs/app/getting-started/error-handling#server-functions
    // - https://nextjs.org/docs/app/api-reference/functions/forbidden
    throw notFound();
  }

  // https://docs.arcjet.com/bot-protection/reference#bot-verification
  if (decision.results.some(isSpoofedBot)) {
    console.log("Spoofed bot detected and blocked!");

    // For now in Next.js server components `throw notFound();` is the most
    // convenient way to deny access to a page. In the future the currently
    // experimental `throw forbidden()` could be used instead. See:
    // - https://nextjs.org/docs/app/getting-started/error-handling#server-functions
    // - https://nextjs.org/docs/app/api-reference/functions/forbidden
    throw new Error("Forbidden");
  }

  // Only used to display the correct url in the example
  const headersList = await headers();
  const hostname = headersList.get("host") ?? "localhost";
  const protocol = hostname?.match(/^(localhost|127.0.0.1):\d+$/)
    ? "http"
    : "https";

  const curlCommand = `curl -I -H "User-Agent: Mozilla/5.0 \\
  (compatible; Googlebot/2.1;+http://www.google.com/bot.html)" \\
  ${protocol}://${hostname}
`;

  return (
    <main className="page">
      <div className="section">
        <h1 className="heading-primary">
          Arcjet Next.js bot protection example app
        </h1>
        <p className="typography-primary">
          This page is protected by{" "}
          <Link
            href="https://docs.arcjet.com/bot-protection/concepts"
            target="_blank"
            className="link"
          >
            Arcjet&apos;s bot protection
          </Link>
          .
        </p>
      </div>

      <hr className="divider" />

      <div className="section">
        <h2 className="heading-secondary">Try it</h2>
        <p className="typography-secondary">
          Make a request pretending to be Googlebot: <code>curl</code>:
        </p>
        <pre className="codeblock">{curlCommand}</pre>
        <p className="typography-secondary">
          You should see a <code>404 Not found</code> response. (Returning a{" "}
          <code>403 Forbidden</code> from a server component is{" "}
          <Link
            href="https://nextjs.org/docs/app/api-reference/functions/forbidden"
            target="_blank"
            className="link"
          >
            experimental in Next.js
          </Link>
          )
        </p>
      </div>
    </main>
  );
}
