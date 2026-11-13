// @ts-check
import path from "node:path";

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  // The Rampart sensitive-info backend loads native ONNX/Transformers modules
  // that must not be bundled by Next.js.
  serverExternalPackages: [
    "@arcjet/sensitive-info-rampart",
    "@huggingface/transformers",
    "onnxruntime-node",
  ],
  // Next.js warns when it finds lockfiles in parent directories, as it does in
  // the arcjet/examples repository. Set the tracing root to this directory.
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/output#caveats
  outputFileTracingRoot: path.join(import.meta.dirname, "."),
};

export default nextConfig;
