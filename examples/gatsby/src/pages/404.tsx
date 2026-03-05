import { type HeadFC, Link, type PageProps } from "gatsby";
// biome-ignore lint/correctness/noUnusedImports: Gatsby's classic JSX transform requires React in scope at runtime
import * as React from "react";
import Layout from "../components/Layout";

const NotFoundPage = (_props: PageProps) => {
  return (
    <Layout>
      <main className="page">
        <div className="section">
          <h1 className="heading-primary">Page not found</h1>
          <p className="typography-primary">
            Sorry, we couldn&apos;t find what you were looking for.
          </p>
          <Link to="/" className="button-primary">
            Go home
          </Link>
        </div>
      </main>
    </Layout>
  );
};

export default NotFoundPage;

export const Head: HeadFC = () => <title>Not found</title>;
