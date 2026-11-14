import { tavily } from "@tavily/core";
import { RetrievalError } from "./telem";
import type { SourceResult } from "./types";

/**
 * Direct Tavily retrieval (https://docs.tavily.com/). Used as the secondary service: when Telem
 * fails or returns no useful evidence, and when the user explicitly asks for Deep Research.
 * Results from here are tagged `via: "tavily-direct"` so they are never confused with a
 * Tavily call that Telem routed internally.
 */

export const TAVILY_TIMEOUT_MS = 20_000;

export type TavilySearchResult = { sources: SourceResult[]; latencyMs: number; requestId?: string };

type TavilyLikeResult = {
  title?: string | null;
  url?: string | null;
  content?: string | null;
  score?: number | null;
  publishedDate?: string | null;
};

export function normalizeTavilyResponse(response: { results?: TavilyLikeResult[] | null }): SourceResult[] {
  const out: SourceResult[] = [];
  (response.results ?? []).forEach((r, i) => {
    if (!r?.url || !/^https?:\/\//i.test(r.url)) return;
    const snippet = (r.content ?? "").replace(/\s+/g, " ").trim();
    out.push({
      id: `tavily-direct-${i}`,
      title: (r.title ?? "").trim() || r.url,
      url: r.url,
      snippet: snippet.length > 900 ? `${snippet.slice(0, 899).trimEnd()}…` : snippet,
      provider: "tavily",
      via: "tavily-direct",
      providerRank: i + 1,
      providerScore: typeof r.score === "number" ? r.score : undefined,
      publishedDate: r.publishedDate || undefined,
    });
  });
  return out;
}

export function tavilyConfigured(): boolean {
  return !!process.env.TAVILY_API_KEY?.trim();
}

export async function tavilySearch(query: string, depth: "basic" | "advanced" = "advanced"): Promise<TavilySearchResult> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) throw new RetrievalError("not_configured", "TAVILY_API_KEY is not set.");
  const client = tavily({ apiKey });
  const started = Date.now();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new RetrievalError("timeout", `Tavily did not respond within ${TAVILY_TIMEOUT_MS / 1000}s.`)),
      TAVILY_TIMEOUT_MS,
    );
  });

  try {
    const response = await Promise.race([
      client.search(query, { searchDepth: depth, maxResults: 5, includeAnswer: false }),
      timeout,
    ]);
    return {
      sources: normalizeTavilyResponse(response),
      latencyMs: Date.now() - started,
      requestId: response.requestId,
    };
  } catch (err) {
    if (err instanceof RetrievalError) throw err;
    const message = err instanceof Error ? err.message : "";
    const status = /\b(401|403)\b/.test(message) || /unauthorized|invalid api key/i.test(message);
    if (status) throw new RetrievalError("auth", "Tavily rejected the API key.");
    if (/\b429\b/.test(message)) throw new RetrievalError("rate_limit", "Tavily rate limit reached.");
    throw new RetrievalError("upstream", "Tavily search failed.");
  } finally {
    if (timer) clearTimeout(timer);
  }
}
