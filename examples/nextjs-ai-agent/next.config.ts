import { withWorkflow } from "workflow/next";
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This example ships with its own `package-lock.json`. Point Next.js at this
  // directory for file tracing so it doesn't warn about other lockfiles that
  // may exist further up the tree.
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/output#caveats
  outputFileTracingRoot: path.join(import.meta.dirname, "."),
};

export default withWorkflow(nextConfig);
