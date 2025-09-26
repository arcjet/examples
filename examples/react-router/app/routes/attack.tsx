import { WhatNext } from "~/components/WhatNext";

const protocol = "http";
const hostname = "localhost:5173";

export default function Component() {
  return (
    <main className="page">
      <div className="section">
        <h1 className="heading-primary">Arcjet attack protection example</h1>
        <p className="typography-primary">
          This page is protected by{" "}
          <a href="https://docs.arcjet.com/shield/concepts" className="link">
            Arcjet Shield
          </a>
          .
        </p>
        <p className="typography-secondary">
          Once a certain suspicion threshold is reached, subsequent requests
          from that client are blocked for a period of time. Shield detects{" "}
          <a
            href={
              "https://docs.arcjet.com/shield/concepts#which-attacks-will-arcjet-shield-block"
            }
            className="link"
          >
            suspicious behavior
          </a>
          , such as SQL injection and cross-site scripting attacks.
        </p>
      </div>

      <hr className="divider" />

      <div className="section">
        <h2 className="heading-secondary">Try it</h2>
        <p className="typography-secondary">
          Simulate an attack using <code>curl</code>:
        </p>
        <pre className="codeblock">
          curl -v -H &quot;x-arcjet-suspicious: true&quot; {protocol}://
          {hostname}/attack/test
        </pre>
        <p className="typography-secondary">
          After the 5th request, your IP will be blocked for 15 minutes.
          Suspicious requests must meet a threshold before they are blocked to
          avoid false positives.
        </p>
        <p className="typography-secondary">
          Shield can also be installed in middleware to protect your entire
          site.
        </p>
      </div>

      <hr className="divider" />

      <div className="section">
        <h2 className="heading-secondary">See the code</h2>
        <p className="typography-secondary">
          The{" "}
          <a
            href="https://github.com/arcjet/example-react-router/blob/main/app/routes/attack_.test.tsx"
            target="_blank"
            rel="noreferrer"
            className="link"
          >
            server loader
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
