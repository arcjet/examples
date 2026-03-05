import * as React from "react";
import { Link, type HeadFC, type PageProps } from "gatsby";
import Layout from "../components/Layout";

const NotFoundPage: React.FC<PageProps> = () => {
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
