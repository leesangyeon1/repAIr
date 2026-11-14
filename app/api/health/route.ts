import { NextResponse } from "next/server";
import { llmConfigured } from "@/lib/llm";
import { tavilyConfigured } from "@/lib/tavily";
import { telemConfigured } from "@/lib/telem";
import type { HealthResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reports only whether keys are present. Never returns key values or fragments. */
export function GET() {
  const body: HealthResponse = {
    status: "ok",
    telemConfigured: telemConfigured(),
    tavilyConfigured: tavilyConfigured(),
    llmConfigured: llmConfigured(),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
