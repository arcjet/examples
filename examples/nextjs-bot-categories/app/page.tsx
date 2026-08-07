import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Bot categories example",
  description:
    "An example of Arcjet's category-based bot detection for Next.js.",
};

export default async function IndexPage() {
  // Only used to display the correct url in the example
  const headersList = await headers();
  const hostname = headersList.get("host") ?? "localhost:3000";
  const protocol = hostname.match(/^(localhost|127.0.0.1):\d+$/)
    ? "http"
    : "https";
  const url = `${protocol}://${hostname}/api/arcjet`;

  return (
    <main className="page">
      <div className="section">
        <h1 className="heading-primary">
          Arcjet Next.js bot categories example app
        </h1>
        <p className="typography-primary">
          The <code>/api/arcjet</code> route is protected by{" "}
          <Link
            href="https://docs.arcjet.com/bot-protection/concepts"
            target="_blank"
            className="link"
          >
            Arcjet&apos;s bot detection
          </Link>
          . The allow list is built by category (<code>CATEGORY:TOOL</code>), by
          an individual bot (<code>VERCEL_MONITOR_PREVIEW</code>), and by
          filtering an individual bot out of a category so that{" "}
          <code>GOOGLE_ADSBOT</code> is still denied while the rest of{" "}
          <code>CATEGORY:GOOGLE</code> is allowed.
        </p>
      </div>

      <hr className="divider" />

      <div className="section">
        <h2 className="heading-secondary">Try it</h2>
        <p className="typography-secondary">
          Request the API as <code>curl</code>, which belongs to{" "}
          <code>CATEGORY:TOOL</code> and is allowed:
        </p>
        <pre className="codeblock">{`curl -v ${url}`}</pre>
        <p className="typography-secondary">
          The response includes headers showing which bots were allowed and
          denied:
        </p>
        <pre className="codeblock">{`x-arcjet-bot-allowed: CATEGORY:TOOL, CURL
x-arcjet-bot-denied:`}</pre>

        <p className="typography-secondary">
          Now pretend to be Vercel&apos;s screenshot bot, which is allowed as an
          individual bot even though its category is not:
        </p>
        <pre className="codeblock">{`curl -v -A "vercel-screenshot" ${url}`}</pre>
        <pre className="codeblock">{`x-arcjet-bot-allowed: VERCEL_MONITOR_PREVIEW
x-arcjet-bot-denied:`}</pre>

        <p className="typography-secondary">
          Finally, pretend to be Google&apos;s AdsBot, which we filtered out of{" "}
          <code>CATEGORY:GOOGLE</code>, so it is denied with a{" "}
          <code>403</code>:
        </p>
        <pre className="codeblock">{`curl -v -A "AdsBot-Google" ${url}`}</pre>
        <pre className="codeblock">{`x-arcjet-bot-allowed:
x-arcjet-bot-denied: GOOGLE_ADSBOT`}</pre>
      </div>
    </main>
  );
}
