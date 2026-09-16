import { type NextRequest, NextResponse } from "next/server";
import { formSchema } from "@/app/schema";
import arcjet, { detectBot, shield, slidingWindow } from "@/lib/arcjet";

const aj = arcjet
  // Shield protects your app from common attacks e.g. SQL injection
  .withRule(shield({ mode: "LIVE" }))
  // Block automated clients from submitting the form
  .withRule(
    detectBot({
      mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
      allow: [], // Block all bots. See https://arcjet.com/bot-list
    }),
  )
  // Limit how often a single IP can submit the form
  .withRule(
    slidingWindow({
      mode: "LIVE",
      interval: "10m",
      max: 5,
    }),
  );

export async function POST(req: NextRequest) {
  const json = await req.json();
  const data = formSchema.safeParse(json);

  if (!data.success) {
    const { error } = data;

    return NextResponse.json(
      { message: "invalid request", error },
      { status: 400 },
    );
  }

  // The protect method returns a decision object that contains information
  // about the request.
  const decision = await aj.protect(req);

  console.log("Arcjet decision: ", decision);

  if (decision.isDenied()) {
    if (decision.reason.isBot()) {
      return NextResponse.json(
        {
          message: "bots are not allowed.",
          reason: decision.reason,
        },
        { status: 403 },
      );
    } else if (decision.reason.isRateLimit()) {
      return NextResponse.json(
        {
          message: "too many requests. Please try again later.",
          reason: decision.reason,
        },
        { status: 429 },
      );
    } else {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json({
    ok: true,
  });
}
