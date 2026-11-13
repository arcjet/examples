import { withWorkflow } from "workflow/next";
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next.js warns when it finds lockfiles in parent directories, as it does in
  // the arcjet/examples repository. Set the tracing root to this directory.
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/output#caveats
  outputFileTracingRoot: path.join(import.meta.dirname, "."),
};

export default withWorkflow(nextConfig);
