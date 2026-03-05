import * as React from "react";
import type { HeadFC, PageProps } from "gatsby";
import Layout from "../components/Layout";
import { WhatNext } from "../components/WhatNext";

const RateLimitingPage: React.FC<PageProps> = () => {
  const [result, setResult] = React.useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/rate-limiting", { method: "POST" });
    const data = await res.json();

    if (data.message) {
      setResult(data.message);
    } else if (data.error) {
      setResult(data.error);
    }
  }

  return (
    <Layout>
      <main className="page">
        <div className="section">
          <h1 className="heading-primary">Arcjet rate limiting example</h1>
          <p className="typography--description">
            This page is protected by{" "}
            <a
              href="https://docs.arcjet.com/rate-limiting/concepts"
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
          <form className="form" onSubmit={onSubmit}>
            <button type="submit" className="button-primary form-button">
              Push me
            </button>
          </form>
          {result && <code className="codeblock">{result}</code>}
          <p>The limit is set to 2 requests every 60 seconds.</p>
          <p className="typography--subtitle">
            Rate limits can be{" "}
            <a
              href="https://docs.arcjet.com/reference/gatsby#ad-hoc-rules"
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
              href="https://github.com/arcjet/example-gatsby/blob/main/src/api/rate-limiting.ts"
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              API route
            </a>{" "}
            configures Arcjet with rate limiting rules using{" "}
            <a
              href="https://github.com/arcjet/example-gatsby/blob/main/src/api/rate-limiting.ts"
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              <code>@arcjet/node</code>
            </a>
            .
          </p>
        </div>

        <hr className="divider" />

        <WhatNext />
      </main>
    </Layout>
  );
};

export default RateLimitingPage;

export const Head: HeadFC = () => <title>Rate Limiting - Arcjet Example</title>;
