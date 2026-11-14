import { z } from "zod";
import type { ProviderRun, SourceResult } from "./types";

/**
 * Server-side client for the Telem AI router (https://docs.telem.ai/api/).
 *
 * POST /v1/search does not return a flat `results` array. It returns `preprocessor_runs[]`,
 * one envelope per provider (and per query), each with its own status, latency, error and
 * `output_payload.results`. A failing provider does not fail the call. When auto-routing is
 * requested, the top-level `routing` field lists the providers Telem's router picked.
 */

export const TELEM_BASE_URL = "https://router.telem.ai";
export const TELEM_SEARCH_TIMEOUT_MS = 14_000;
export const TELEM_FETCH_TIMEOUT_MS = 9_000;
export const PINNED_PROVIDERS = ["exa", "brave"] as const;

export type RetrievalErrorKind =
  | "not_configured"
  | "auth"
  | "timeout"
  | "rate_limit"
  | "bad_request"
  | "upstream"
  | "network"
  | "schema";

export class RetrievalError extends Error {
  constructor(
    public kind: RetrievalErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "RetrievalError";
  }
}

/* ---------- Response schemas (lenient: unknown fields are ignored, most are optional) ---------- */

const telemResultSchema = z
  .object({
    url: z.string().nullish(),
    title: z.string().nullish(),
    rank: z.number().nullish(),
    summary: z.string().nullish(),
    excerpt: z.string().nullish(),
    full_content: z.string().nullish(),
    publish_date: z.string().nullish(),
  })
  .loose();

const telemRunSchema = z
  .object({
    preprocessor_name: z.string().nullish(),
    status: z.string().nullish(),
    batch_index: z.number().nullish(),
    latency_ms: z.number().nullish(),
    error: z.unknown().optional(),
    output_payload: z
      .object({
        results: z.array(telemResultSchema).nullish(),
        fetched_results: z.array(z.unknown()).nullish(),
      })
      .loose()
      .nullish(),
  })
  .loose();

export const telemSearchResponseSchema = z
  .object({
    session_id: z.string().nullish(),
    interaction_id: z.string().nullish(),
    status: z.string().nullish(),
    preprocessor_runs: z.array(telemRunSchema),
    routing: z
      .array(z.object({ providers: z.array(z.string()).nullish() }).loose().nullable())
      .nullish(),
    pinned_providers: z.array(z.string()).nullish(),
  })
  .loose();

const telemFetchedSchema = z
  .object({
    url: z.string().nullish(),
    status: z.string().nullish(),
    provider: z.string().nullish(),
    title: z.string().nullish(),
    canonical_url: z.string().nullish(),
    content: z.string().nullish(),
    content_truncated: z.boolean().nullish(),
  })
  .loose();

export type TelemStrategy = "auto" | "pinned";

export type TelemSearchResult = {
  sources: SourceResult[];
  providers: ProviderRun[];
  /** Providers chosen by Telem's router, when the response includes `routing`. */
  routedProviders?: string[];
  interactionId?: string;
  status?: string;
  strategy: string;
  latencyMs: number;
};

export type TelemFetchedPage = {
  url: string;
  ok: boolean;
  provider?: string;
  title?: string;
  content: string;
  truncated: boolean;
};

export type TelemFetchResult = { pages: TelemFetchedPage[]; latencyMs: number };

function errorText(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const msg = o.message ?? o.code ?? o.reason ?? o.detail;
    if (typeof msg === "string") return msg;
    try {
      return JSON.stringify(err).slice(0, 200);
    } catch {
      return "provider error";
    }
  }
  return String(err);
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function clean(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Flatten Telem's per-provider envelopes into SourceResults while keeping provider provenance. */
export function normalizeTelemSearchResponse(json: unknown): {
  sources: SourceResult[];
  providers: ProviderRun[];
  routedProviders?: string[];
  interactionId?: string;
  status?: string;
} {
  const parsed = telemSearchResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new RetrievalError("schema", "Telem returned a response repAIr could not parse.");
  }
  const data = parsed.data;
  const sources: SourceResult[] = [];
  const providers: ProviderRun[] = [];

  data.preprocessor_runs.forEach((run, runIndex) => {
    const name = run.preprocessor_name ?? "unknown";
    const results = run.output_payload?.results ?? [];
    let count = 0;
    results.forEach((r, i) => {
      if (!r.url || !isHttpUrl(r.url)) return;
      count++;
      sources.push({
        id: `telem-${name}-${runIndex}-${i}`,
        title: clean(r.title, 200) || r.url,
        url: r.url,
        snippet: clean(r.excerpt || r.summary || r.full_content, 900),
        provider: name,
        via: "telem",
        providerRank: typeof r.rank === "number" ? r.rank : undefined,
        publishedDate: r.publish_date ?? undefined,
      });
    });
    providers.push({
      name,
      status: run.status ?? (run.error ? "failed" : "unknown"),
      latencyMs: typeof run.latency_ms === "number" ? Math.round(run.latency_ms) : undefined,
      resultCount: count,
      error: errorText(run.error),
    });
  });

  const routed = (data.routing ?? []).flatMap((r) => r?.providers ?? []);
  return {
    sources,
    providers,
    routedProviders: routed.length ? [...new Set(routed)] : undefined,
    interactionId: data.interaction_id ?? undefined,
    status: data.status ?? undefined,
  };
}

export function normalizeTelemFetchResponse(json: unknown): TelemFetchedPage[] {
  const parsed = telemSearchResponseSchema.safeParse(json);
  if (!parsed.success) throw new RetrievalError("schema", "Telem fetch returned an unexpected response.");
  const pages: TelemFetchedPage[] = [];
  for (const run of parsed.data.preprocessor_runs) {
    for (const raw of run.output_payload?.fetched_results ?? []) {
      const item = telemFetchedSchema.safeParse(raw);
      if (!item.success || !item.data.url) continue;
      const content = (item.data.content ?? "").trim();
      pages.push({
        url: item.data.url,
        ok: item.data.status === "succeeded" && content.length > 0,
        provider: item.data.provider ?? undefined,
        title: item.data.title ?? undefined,
        content,
        truncated: !!item.data.content_truncated,
      });
    }
  }
  return pages;
}

export function buildSearchBody(query: string, strategy: TelemStrategy, numResults = 3): Record<string, unknown> {
  return {
    user_input: { query },
    search:
      strategy === "auto"
        ? { auto_routing: "accuracy", num_results: numResults }
        : { providers: { include: [...PINNED_PROVIDERS] }, num_results: numResults },
  };
}

export const strategyLabel = (strategy: TelemStrategy): string =>
  strategy === "auto" ? "auto_routing: accuracy (Telem picks providers)" : `pinned: ${PINNED_PROVIDERS.join(", ")}`;

async function telemPost(path: string, body: unknown, timeoutMs: number, apiKey: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${TELEM_BASE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new RetrievalError("timeout", `Telem did not respond within ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw new RetrievalError("network", "Could not reach Telem.");
  }

  if (!response.ok) {
    let detail = "";
    try {
      const j = (await response.json()) as Record<string, unknown>;
      detail = errorText(j.detail) ?? errorText(j.error) ?? "";
    } catch {
      /* non-JSON error body */
    }
    const suffix = detail ? `: ${detail.slice(0, 160)}` : "";
    const s = response.status;
    if (s === 401 || s === 403) throw new RetrievalError("auth", `Telem rejected the API key (${s})${suffix}`, s);
    if (s === 429) throw new RetrievalError("rate_limit", `Telem rate limit reached (429)${suffix}`, s);
    if (s === 504) throw new RetrievalError("timeout", `Telem deadline exceeded (504)${suffix}`, s);
    if (s === 400 || s === 422) throw new RetrievalError("bad_request", `Telem rejected the request (${s})${suffix}`, s);
    throw new RetrievalError("upstream", `Telem search failed (${s})${suffix}`, s);
  }

  try {
    return await response.json();
  } catch {
    throw new RetrievalError("schema", "Telem returned a non-JSON response.");
  }
}

export function telemConfigured(): boolean {
  return !!process.env.TELEM_API_KEY?.trim();
}

/** Live multi-provider search through Telem. Latency is measured around the HTTP call. */
export async function telemSearch(query: string, strategy: TelemStrategy): Promise<TelemSearchResult> {
  const apiKey = process.env.TELEM_API_KEY?.trim();
  if (!apiKey) throw new RetrievalError("not_configured", "TELEM_API_KEY is not set.");
  const started = Date.now();
  const json = await telemPost("/v1/search", buildSearchBody(query, strategy), TELEM_SEARCH_TIMEOUT_MS, apiKey);
  const normalized = normalizeTelemSearchResponse(json);
  return { ...normalized, strategy: strategyLabel(strategy), latencyMs: Date.now() - started };
}

/**
 * Fetch fuller page text through Telem's /v1/fetch. Only called with URLs that Telem search
 * itself returned, so this is never an open fetch proxy.
 */
export async function telemFetch(urls: string[], maxChars = 6000): Promise<TelemFetchResult> {
  const apiKey = process.env.TELEM_API_KEY?.trim();
  if (!apiKey) throw new RetrievalError("not_configured", "TELEM_API_KEY is not set.");
  const unique = [...new Set(urls.filter(isHttpUrl))].slice(0, 5);
  if (!unique.length) return { pages: [], latencyMs: 0 };
  const started = Date.now();
  const json = await telemPost(
    "/v1/fetch",
    { urls: unique, options: { content_format: "text", inline_max_chars: maxChars } },
    TELEM_FETCH_TIMEOUT_MS,
    apiKey,
  );
  return { pages: normalizeTelemFetchResponse(json), latencyMs: Date.now() - started };
}
