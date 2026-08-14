import { NextResponse } from "next/server";
import {
  clients,
  defaultInjectionModel,
  defaultModel,
  models,
  scenarios,
} from "@/lib/demo";

export function GET() {
  // Demo-only: returns synthetic fixture records so the UI can show policy
  // evaluation. Do not copy this into production — hosted APIs must return
  // display-safe labels and omit raw records, prompts, and tool traces.
  return NextResponse.json({
    clients,
    models: Object.fromEntries(
      Object.entries(models).map(([id, model]) => [id, { label: model.label }]),
    ),
    defaultModel,
    defaultInjectionModel,
    scenarios: Object.fromEntries(
      Object.entries(scenarios).map(([id, scenario]) => [
        id,
        { label: scenario.label, message: scenario.message },
      ]),
    ),
  });
}
