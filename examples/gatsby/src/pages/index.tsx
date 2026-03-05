import { type HeadFC, Link, type PageProps } from "gatsby";
// biome-ignore lint/correctness/noUnusedImports: Gatsby's classic JSX transform requires React in scope at runtime
import * as React from "react";
import Layout from "../components/Layout";
import { WhatNext } from "../components/WhatNext";

const IndexPage = (_props: PageProps) => {
  return (
    <Layout>
      <main className="page">
        <div className="section">
          <h1 className="heading-primary">Arcjet Gatsby example app</h1>
          <p className="typography-primary">
            <a
              href="https://arcjet.com"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              Arcjet
            </a>{" "}
            helps developers protect their apps in just a few lines of code. Bot
            detection. Rate limiting. Email validation. Attack protection. Data
            redaction. A developer-first approach to security.
          </p>
          <p className="typography-secondary">
            This is an example Gatsby application using Arcjet. The code is{" "}
            <a
              href="https://github.com/arcjet/example-gatsby"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              on GitHub
            </a>
            .
          </p>
        </div>

        <div className="section">
          <h2 className="heading-secondary">Examples</h2>
          <div className="list-actions">
            <Link to="/rate-limiting" className="button-primary">
              Rate limiting
            </Link>
          </div>
        </div>

        <hr className="divider" />

        <WhatNext />
      </main>
    </Layout>
  );
};

export default IndexPage;

export const Head: HeadFC = () => (
  <>
    <title>Arcjet Gatsby example app</title>
    <meta
      name="description"
      content="An example Gatsby application protected by Arcjet. Bot detection. Rate limiting. Email validation. Attack protection. Data redaction. A developer-first approach to security."
    />
  </>
);
