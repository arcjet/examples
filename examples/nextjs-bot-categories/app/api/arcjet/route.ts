import { arcjet } from "@/lib/arcjet";
import { isSpoofedBot } from "@arcjet/inspect";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const decision = await arcjet.protect(req);

  if (decision.isErrored()) {
    return NextResponse.json(
      { error: decision.reason.message },
      { status: 500, statusText: "Internal Server Error" },
    );
  }

  const headers = new Headers();
  if (decision.reason.isBot()) {
    // WARNING: This is illustrative! Don't share this metadata with users;
    // otherwise they may use it to subvert bot detection!
    headers.set("X-Arcjet-Bot-Allowed", decision.reason.allowed.join(", "));
    headers.set("X-Arcjet-Bot-Denied", decision.reason.denied.join(", "));
  }

  // Verify that the detected bot is who they say they are.
  // https://docs.arcjet.com/bot-protection/reference#bot-verification
  if (decision.results.some(isSpoofedBot)) {
    return NextResponse.json(
      { error: "You are pretending to be a good bot!" },
      { status: 403, headers },
    );
  }

  // Bots not in the allow list will be denied
  if (decision.isDenied()) {
    return NextResponse.json(
      { error: "You are a bot!" },
      { status: 403, headers },
    );
  }

  return NextResponse.json({ message: "Hello world" }, { status: 200, headers });
}
