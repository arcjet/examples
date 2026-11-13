// @ts-check
import path from "node:path";

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Next.js warns when it finds lockfiles in parent directories, as it does in
  // the arcjet/examples repository. Set the tracing root to this directory.
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/output#caveats
  outputFileTracingRoot: path.join(import.meta.dirname, "."),
};

export default nextConfig;
