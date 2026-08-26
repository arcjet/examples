import arcjet, { sensitiveInfo, shield } from "@arcjet/next";
import { NextResponse } from "next/server";

// This function is called by the `sensitiveInfo` rule to perform custom
// detection on strings. It runs on-device against the tokens Arcjet extracts
// from the request body.
function detectDash(tokens: string[]): Array<"CONTAINS_DASH" | undefined> {
  return tokens.map((token) => {
    if (token.includes("-")) {
      return "CONTAINS_DASH";
    }
  });
}

const aj = arcjet({
  // Get your Arcjet key from https://console.arcjet.com and set it as an
  // environment variable rather than hard coding it.
  // See: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
  key: process.env.ARCJET_KEY!,
  rules: [
    shield({
      mode: "LIVE", // Will block requests. Use "DRY_RUN" to log only.
    }),
    // Blocks email addresses and any custom-detected values that contain a
    // dash. Use `allow` instead of `deny` to block everything except the
    // listed types.
    sensitiveInfo({
      deny: ["EMAIL", "CONTAINS_DASH"],
      mode: "LIVE", // Will block requests. Use "DRY_RUN" to log only.
      detect: detectDash,
      contextWindowSize: 2, // Two tokens are provided to `detect` at a time.
    }),
  ],
});

export async function POST(req: Request) {
  const value = await req.text();
  const decision = await aj.protect(req, { sensitiveInfoValue: value });

  if (decision.isDenied()) {
    return NextResponse.json(
      {
        error: "Sensitive Information Identified",
        reason: decision.reason,
      },
      {
        status: 400,
      },
    );
  }

  return NextResponse.json({ message: `You said: ${value}` });
}
