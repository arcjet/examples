import { NextResponse } from "next/server";
import { publicDemoContext } from "@/lib/demo";

export function GET() {
  // Labels and selector IDs only. Client records, allowed recipients, and
  // scenario prompts stay on the server (see lib/demo.ts + /api/evaluate).
  return NextResponse.json(publicDemoContext());
}
