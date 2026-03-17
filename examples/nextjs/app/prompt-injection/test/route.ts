import { type NextRequest, NextResponse } from "next/server";
import { formSchema } from "@/app/prompt-injection/schema";
import arcjet, { detectPromptInjection, shield } from "@/lib/arcjet";

// Add rules to the base Arcjet instance outside of the handler function
const aj = arcjet
  .withRule(
    detectPromptInjection({
      mode: "LIVE", // Will block requests, use "DRY_RUN" to log only
    }),
  )
  // You can chain multiple rules, so we'll include shield
  .withRule(
    // Shield detects suspicious behavior, such as SQL injection and cross-site
    // scripting attacks.
    shield({
      mode: "LIVE",
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
  const decision = await aj.protect(req, {
    // Pass the prompt to be evaluated for prompt injection
    detectPromptInjectionMessage: data.data.userPrompt,
  });

  console.log("Arcjet decision: ", decision);

  if (decision.isDenied()) {
    if (decision.reason.isPromptInjection()) {
      return NextResponse.json(
        {
          message: "prompt injection detected.",
          detected: true,
          reason: decision.reason,
        },
        { status: 400 },
      );
    } else {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  } else if (decision.isErrored()) {
    console.error("Arcjet error:", decision.reason);
    if (decision.reason.message === "[unauthenticated] invalid key") {
      return NextResponse.json(
        {
          message:
            "invalid Arcjet key. Is the ARCJET_KEY environment variable set?",
        },
        { status: 500 },
      );
    } else {
      return NextResponse.json(
        { message: `Internal server error: ${decision.reason.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    message: "no prompt injection detected.",
    detected: false,
  });
}
