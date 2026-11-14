import { NextResponse } from "next/server";
import { runDeepResearch } from "@/lib/retrieval";
import { getDataset } from "@/lib/datasets";
import { liveDeps, readJsonBody } from "@/lib/server-deps";
import { researchRequestSchema, searchResponseSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Explicit Deep Research: a direct Tavily request, kept separate from Telem-routed retrieval. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return NextResponse.json({ error: "Request body must be JSON under 4 KB." }, { status: 400 });
  }
  const parsed = researchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request: `query` must be 2-300 characters." },
      { status: 400 },
    );
  }
  try {
    const result = await runDeepResearch(parsed.data, { ...liveDeps(), graph: getDataset(parsed.data.datasetId).graph });
    return NextResponse.json(searchResponseSchema.parse(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[repAIr] /api/research failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Deep Research failed unexpectedly. Please try again." }, { status: 500 });
  }
}
