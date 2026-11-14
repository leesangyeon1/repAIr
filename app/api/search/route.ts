import { NextResponse } from "next/server";
import { runSearchPipeline } from "@/lib/retrieval";
import { liveDeps, readJsonBody } from "@/lib/server-deps";
import { searchRequestSchema, searchResponseSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return NextResponse.json({ error: "Request body must be JSON under 4 KB." }, { status: 400 });
  }
  const parsed = searchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request: `query` must be 2-300 characters." },
      { status: 400 },
    );
  }
  try {
    const result = await runSearchPipeline(parsed.data, liveDeps());
    return NextResponse.json(searchResponseSchema.parse(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[repAIr] /api/search failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Search failed unexpectedly. Please try again." }, { status: 500 });
  }
}
