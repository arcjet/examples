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
  // The Rampart backend loads a native ONNX runtime
  // (`@huggingface/transformers` / `onnxruntime-node`) and reads its bundled
  // model weights from disk at runtime. Mark them as server external packages
  // so Next.js loads them from `node_modules` at runtime rather than trying to
  // bundle the native binary and model files into the server build.
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
  serverExternalPackages: [
    "@arcjet/sensitive-info-rampart",
    "@huggingface/transformers",
    "onnxruntime-node",
  ],
};

export default nextConfig;
