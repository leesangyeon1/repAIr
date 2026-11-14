import { describe, expect, it, vi } from "vitest";
import {
  analyzeQuery,
  classifyIntent,
  dedupeSources,
  rankSources,
  runDeepResearch,
  runSearchPipeline,
  type RetrievalDeps,
} from "@/lib/retrieval";
import { normalizeTavilyResponse } from "@/lib/tavily";
import {
  RetrievalError,
  buildSearchBody,
  normalizeTelemFetchResponse,
  normalizeTelemSearchResponse,
  strategyLabel,
} from "@/lib/telem";
import { searchResponseSchema } from "@/lib/types";
import telemFetchFixture from "./fixtures/telem-fetch.json";
import telemFixture from "./fixtures/telem-search.json";
import tavilyFixture from "./fixtures/tavily-search.json";

describe("Telem normalization", () => {
  const n = normalizeTelemSearchResponse(telemFixture);

  it("flattens per-provider envelopes and keeps provenance", () => {
    expect(n.sources.map((s) => s.provider)).toEqual(["exa", "exa", "brave"]);
    expect(n.sources.every((s) => s.via === "telem")).toBe(true);
    expect(n.sources[0]).toMatchObject({ title: "Why a coolant pump delivers low flow", providerRank: 1 });
    expect(n.sources[0].snippet).toContain("worn impeller");
  });

  it("drops results without a usable http(s) URL", () => {
    expect(n.sources.some((s) => s.url.startsWith("javascript:"))).toBe(false);
    expect(n.providers.find((p) => p.name === "brave")?.resultCount).toBe(1);
  });

  it("reports provider status, Telem latency, errors and routing as returned", () => {
    expect(n.providers).toEqual([
      { name: "exa", status: "succeeded", latencyMs: 812, resultCount: 2, error: undefined },
      { name: "brave", status: "succeeded", latencyMs: 430, resultCount: 1, error: undefined },
      { name: "tavily", status: "failed", latencyMs: 5000, resultCount: 0, error: "upstream timed out" },
    ]);
    expect(n.routedProviders).toEqual(["exa", "brave", "tavily"]);
    expect(n.interactionId).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("rejects payloads that are not a Telem search response", () => {
    expect(() => normalizeTelemSearchResponse({ results: [] })).toThrow(RetrievalError);
  });

  it("normalizes /v1/fetch pages", () => {
    const pages = normalizeTelemFetchResponse(telemFetchFixture);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ ok: true, provider: "jina" });
    expect(pages[1].ok).toBe(false);
  });

  it("builds the documented request bodies", () => {
    expect(buildSearchBody("q", "pinned")).toEqual({
      user_input: { query: "q" },
      search: { providers: { include: ["exa", "brave"] }, num_results: 3 },
    });
    expect(buildSearchBody("q", "auto")).toEqual({
      user_input: { query: "q" },
      search: { auto_routing: "accuracy", num_results: 3 },
    });
  });
});

describe("Tavily normalization", () => {
  it("maps results to SourceResult and tags them as direct calls", () => {
    const sources = normalizeTavilyResponse(tavilyFixture);
    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({
      provider: "tavily",
      via: "tavily-direct",
      providerScore: 0.91,
      publishedDate: "2025-03-02",
      url: "https://example.com/inspect-pump",
    });
    expect(sources[1].title).toBe("https://example.com/untitled");
  });
});

describe("dedupe and ranking", () => {
  const analysis = analyzeQuery("Why is the engine overheating?", null);
  const sources = normalizeTelemSearchResponse(telemFixture).sources;

  it("merges the same page from two providers", () => {
    const deduped = dedupeSources(sources);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].provider).toBe("exa");
    expect(deduped[0].alsoFoundBy).toEqual(["brave"]);
  });

  it("ranks the on-topic source first with a score in [0, 1]", () => {
    const ranked = rankSources(dedupeSources(sources), analysis);
    expect(ranked[0].url).toContain("low-flow");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score ?? 0);
    for (const s of ranked) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("intent and component selection", () => {
  it("classifies intents", () => {
    expect(classifyIntent("Why is the engine overheating?")).toBe("diagnostic");
    expect(classifyIntent("How do I inspect the cooling pump?")).toBe("procedure");
    expect(classifyIntent("Which components are connected to the temperature sensor?")).toBe("relationship");
    expect(classifyIntent("Explain the radiator")).toBe("explanation");
  });

  it("follows symptom → component relationships", () => {
    const a = analyzeQuery("Why is the engine overheating?", "cooling_system");
    expect(a.focusNodeId).toBe("cooling_pump");
    expect(a.highlightNodeIds).toEqual(
      expect.arrayContaining(["engine_overheating", "cooling_pump", "radiator", "cooling_fan", "temperature_sensor"]),
    );
    expect(a.expandedQuery).toMatch(/^Why is the engine overheating /);
    expect(a.expandedQuery).toContain("pump");
    expect(a.graphContext).toContain("Engine Overheating is linked to Cooling Pump");
  });

  it("falls back to the selected node for context", () => {
    const a = analyzeQuery("how is this maintained", "radiator");
    expect(a.focusNodeId).toBe("radiator");
    expect(a.usedSelectionContext).toBe(true);
  });
});

/* ---------- Pipeline behaviour with injected services ---------- */

const telemOk = () => ({
  ...normalizeTelemSearchResponse(telemFixture),
  strategy: strategyLabel("auto"),
  latencyMs: 900,
});
const tavilyOk = () => ({ sources: normalizeTavilyResponse(tavilyFixture), latencyMs: 1200 });

function deps(over: Partial<RetrievalDeps> = {}): RetrievalDeps {
  return {
    telemConfigured: true,
    tavilyConfigured: true,
    telemSearch: vi.fn(async () => telemOk()),
    telemFetch: vi.fn(async () => ({ pages: normalizeTelemFetchResponse(telemFetchFixture), latencyMs: 300 })),
    tavilySearch: vi.fn(async () => tavilyOk()),
    ...over,
  };
}

describe("API fallback behaviour", () => {
  it("uses Telem alone when it returns relevant evidence", async () => {
    const d = deps();
    const r = await runSearchPipeline({ query: "Why is the engine overheating?" }, d);
    expect(() => searchResponseSchema.parse(r)).not.toThrow();
    expect(d.tavilySearch).not.toHaveBeenCalled();
    expect(r.searchMetadata).toMatchObject({ primaryProvider: "telem", fallbackUsed: false, mode: "live" });
    expect(r.searchMetadata.calls.map((c) => c.service)).toEqual(["telem-search", "telem-fetch"]);
    expect(r.focusNodeId).toBe("cooling_pump");
    expect(r.evidenceStatus).toBe("sufficient");
    expect(r.evidence[0].quote).toMatch(/pump/i);
    expect(r.sources.find((s) => s.url.includes("low-flow"))?.fullTextFetched).toBe(true);
    expect(r.newNodes).toEqual([]);
  });

  it("falls back to direct Tavily when Telem fails", async () => {
    const d = deps({
      telemSearch: vi.fn(async () => {
        throw new RetrievalError("timeout", "Telem did not respond within 14s.");
      }),
    });
    const r = await runSearchPipeline({ query: "How do I inspect the cooling pump?" }, d);
    expect(d.tavilySearch).toHaveBeenCalledTimes(1);
    expect(r.searchMetadata.fallbackUsed).toBe(true);
    expect(r.searchMetadata.fallbackReason).toContain("Telem failed");
    expect(r.searchMetadata.calls[0]).toMatchObject({ service: "telem-search", status: "timeout" });
    expect(r.searchMetadata.calls.at(-1)).toMatchObject({ service: "tavily-direct", status: "ok" });
    expect(r.sources.every((s) => s.via === "tavily-direct")).toBe(true);
    expect(d.telemFetch).not.toHaveBeenCalled();
  });

  it("retries with pinned providers when auto-routing is rejected", async () => {
    const telemSearch = vi
      .fn()
      .mockRejectedValueOnce(new RetrievalError("bad_request", "Telem rejected the request (422)", 422))
      .mockResolvedValueOnce({ ...telemOk(), strategy: strategyLabel("pinned") });
    const d = deps({ telemSearch });
    const r = await runSearchPipeline({ query: "Why is the engine overheating?" }, d);
    expect(telemSearch.mock.calls.map((c) => c[1])).toEqual(["auto", "pinned"]);
    expect(d.tavilySearch).not.toHaveBeenCalled();
    expect(r.searchMetadata.fallbackUsed).toBe(false);
    expect(r.searchMetadata.calls.filter((c) => c.service === "telem-search")).toHaveLength(2);
  });

  it("falls back when Telem results are off-topic, and says so", async () => {
    const d = deps({
      telemSearch: vi.fn(async () => ({
        sources: [
          { id: "telem-exa-0-0", title: "Cake recipes", url: "https://example.net/cake", snippet: "Flour, sugar and butter.", provider: "exa", via: "telem" as const },
        ],
        providers: [{ name: "exa", status: "succeeded", resultCount: 1 }],
        strategy: strategyLabel("auto"),
        latencyMs: 500,
      })),
    });
    const r = await runSearchPipeline({ query: "How do I inspect the cooling pump?" }, d);
    expect(d.tavilySearch).toHaveBeenCalledTimes(1);
    expect(r.searchMetadata.fallbackReason).toContain("did not contain evidence");
    expect(r.sources.some((s) => s.via === "telem")).toBe(true);
    expect(r.sources[0].via).toBe("tavily-direct");
  });

  it("reports failure honestly when Telem fails and Tavily is not configured", async () => {
    const d = deps({
      tavilyConfigured: false,
      telemSearch: vi.fn(async () => {
        throw new RetrievalError("auth", "Telem rejected the API key (401)", 401);
      }),
    });
    const r = await runSearchPipeline({ query: "Why is the engine overheating?" }, d);
    expect(d.tavilySearch).not.toHaveBeenCalled();
    expect(r.sources).toEqual([]);
    expect(r.evidenceStatus).toBe("none");
    expect(r.answerMode).toBe("graph-only");
    expect(r.searchMetadata.fallbackUsed).toBe(false);
    expect(r.searchMetadata.fallbackReason).toContain("TAVILY_API_KEY not set");
  });

  it("makes no network calls in demo mode", async () => {
    const d = deps({ telemConfigured: false, tavilyConfigured: false });
    const r = await runSearchPipeline({ query: "Why is the engine overheating?" }, d);
    expect(d.telemSearch).not.toHaveBeenCalled();
    expect(d.tavilySearch).not.toHaveBeenCalled();
    expect(r.searchMetadata).toMatchObject({ mode: "demo", primaryProvider: "none", calls: [] });
    expect(r.evidenceStatus).toBe("not_configured");
    expect(r.highlightNodeIds).toContain("cooling_pump");
  });

  it("answers relationship questions from the graph without searching", async () => {
    const d = deps();
    const r = await runSearchPipeline({ query: "Which components are connected to the temperature sensor?" }, d);
    expect(d.telemSearch).not.toHaveBeenCalled();
    expect(r.evidenceStatus).toBe("not_needed");
    expect(r.highlightNodeIds).toContain("controller");
  });

  it("creates stable, de-duplicated source nodes on expand", async () => {
    const d = deps();
    const r = await runSearchPipeline({ query: "Cooling Pump low coolant flow troubleshooting", selectedNodeId: "cooling_pump", mode: "expand" }, d);
    expect(r.newNodes.length).toBeGreaterThan(0);
    expect(new Set(r.newNodes.map((n) => n.id)).size).toBe(r.newNodes.length);
    for (const node of r.newNodes) {
      expect(node.id).toMatch(/^src_[0-9a-f]{8}$/);
      expect(node.metadata?.url).toMatch(/^https:\/\//);
      expect(node.metadata?.provider).toBeTruthy();
    }
    expect(r.newLinks.every((l) => l.source === "cooling_pump" && l.relation === "DOCUMENTED_IN")).toBe(true);
    const again = await runSearchPipeline({ query: "Cooling Pump low coolant flow troubleshooting", selectedNodeId: "cooling_pump", mode: "expand" }, d);
    expect(again.newNodes.map((n) => n.id)).toEqual(r.newNodes.map((n) => n.id));
  });
});

describe("deep research", () => {
  it("calls Tavily directly and never Telem", async () => {
    const d = deps();
    const r = await runDeepResearch({ query: "How do I inspect the cooling pump?" }, d);
    expect(d.telemSearch).not.toHaveBeenCalled();
    expect(d.tavilySearch).toHaveBeenCalledTimes(1);
    expect(r.searchMetadata.primaryProvider).toBe("tavily");
    expect(r.searchMetadata.calls.map((c) => c.service)).toEqual(["tavily-direct"]);
    expect(r.newNodes.length).toBeGreaterThan(0);
  });

  it("does not pretend to search when Tavily is not configured", async () => {
    const d = deps({ tavilyConfigured: false });
    const r = await runDeepResearch({ query: "How do I inspect the cooling pump?" }, d);
    expect(d.tavilySearch).not.toHaveBeenCalled();
    expect(r.sources).toEqual([]);
    expect(r.answer).toContain("TAVILY_API_KEY is not set");
  });
});
