import * as nosecone from "@nosecone/next";

// Arcjet Nosecone is an open source library that helps set security headers
// such as Content-Security-Policy (CSP). This configuration provides basic
// protection for this Next.js application, but with some exceptions to allow
// for the next-themes and Vercel Analytics features.
//
// See https://docs.arcjet.com/nosecone/quick-start for more information
const noseconeConfig: nosecone.NoseconeOptions = {
  ...nosecone.defaults,
  contentSecurityPolicy: {
    ...nosecone.defaults.contentSecurityPolicy,
    directives: {
      ...nosecone.defaults.contentSecurityPolicy.directives,
      scriptSrc: [
        // We have to use unsafe-inline because next-themes and Vercel Analytics
        // do not support nonce
        // https://github.com/pacocoursey/next-themes/issues/106
        // https://github.com/vercel/analytics/issues/122
        //...nosecone.defaults.contentSecurityPolicy.directives.scriptSrc,
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
      ],
      connectSrc: [
        ...nosecone.defaults.contentSecurityPolicy.directives.connectSrc,
      ],
      // We only set this in production because the server may be started
      // without HTTPS
      upgradeInsecureRequests: process.env.NODE_ENV !== "development",
    },
  },
} as const;

const noseconeMiddleware = nosecone.createMiddleware(
  process.env.VERCEL_ENV === "preview"
    ? nosecone.withVercelToolbar(noseconeConfig)
    : noseconeConfig,
);

export default noseconeMiddleware;
