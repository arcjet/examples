import { type NextRequest, NextResponse } from "next/server";
import { formSchema } from "@/app/schema";
import arcjet from "@/lib/arcjet";

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
  const decision = await arcjet.protect(req);

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
