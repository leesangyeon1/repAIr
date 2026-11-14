import { SEED_GRAPH } from "./graph-data";
import {
  canonicalUrl,
  componentsForSymptom,
  findOwningSystem,
  getNeighborIds,
  getNodeById,
  getRelatedIds,
  hostOf,
  joinNames,
  matchNodesInText,
  sourceNodeId,
  tokenize,
} from "./graph-utils";
import type { LlmEvidence } from "./llm";
import { RetrievalError, type TelemFetchResult, type TelemSearchResult, type TelemStrategy } from "./telem";
import type { TavilySearchResult } from "./tavily";
import type {
  Evidence,
  Intent,
  KnowledgeGraph,
  KnowledgeLink,
  KnowledgeNode,
  RetrievalCall,
  SearchResponse,
  SourceResult,
} from "./types";

/* ------------------------------------------------------------------ */
/* Query understanding                                                 */
/* ------------------------------------------------------------------ */

export function classifyIntent(query: string): Intent {
  const q = ` ${tokenize(query).join(" ")} `;
  if (/ (connected to|connects to|linked to|related to|attached to|part of|belongs? to|which components|what components) /.test(q))
    return "relationship";
  if (/ (how do i|how to|how can i|how should i|inspect|inspection|check|repair|replace|procedure|steps?|verify|test|service|maintain|fix) /.test(q))
    return "procedure";
  if (/ (why|causes?|caused|causing|fails?|failing|failure|fault|faulty|problem|issue|overheat\w*|leak\w*|drops?|not working|broken) /.test(q))
    return "diagnostic";
  if (/ (explain|describe|what is|what's|what does|tell me about|overview) /.test(q)) return "explanation";
  return "general";
}

const STOPWORDS = new Set(
  "a an and are as at be by can could do does for from how i if in into is it its me my of on or our please should so than that the their them then there these this those to us was we what when where which who why will with would you your about tell show find explain give get does did has have had not any all more most some such also may might must".split(
    " ",
  ),
);

export type QueryAnalysis = {
  intent: Intent;
  matchedNodeIds: string[];
  focusNodeId: string | null;
  highlightNodeIds: string[];
  /** True when the focus came from the selected node rather than from words in the query. */
  usedSelectionContext: boolean;
  expandedQuery: string;
  /** Terms taken from graph node names: weighted higher during ranking. */
  keyTerms: string[];
  /** Remaining content words from the query. */
  queryTerms: string[];
  graphContext: string;
};

const INTENT_SUFFIX: Record<Intent, string> = {
  diagnostic: "causes troubleshooting",
  procedure: "inspection procedure maintenance",
  relationship: "",
  explanation: "how it works failure modes",
  general: "",
};

function namesOf(graph: KnowledgeGraph, ids: string[]): string[] {
  return ids.map((id) => getNodeById(graph.nodes, id)?.name).filter((n): n is string => !!n);
}

/**
 * Map a question onto the knowledge graph: which nodes it mentions, which component should take
 * focus, which neighbours are relevant for this intent, and how to phrase the web search.
 */
export function analyzeQuery(
  query: string,
  selectedNodeId: string | null | undefined,
  graph: KnowledgeGraph = SEED_GRAPH,
): QueryAnalysis {
  const intent = classifyIntent(query);
  const matches = matchNodesInText(graph.nodes, query).map((m) => m.node);
  const byType = (type: KnowledgeNode["type"]) => matches.filter((n) => n.type === type);
  const selected = getNodeById(graph.nodes, selectedNodeId);

  const symptom = byType("symptom")[0];
  const component = byType("component")[0];
  let focus: KnowledgeNode | undefined;
  let usedSelectionContext = false;

  if (component) focus = component;
  else if (symptom) focus = componentsForSymptom(graph, symptom.id)[0] ?? symptom;
  else if (byType("system")[0]) focus = byType("system")[0];
  else if (byType("procedure")[0]) focus = byType("procedure")[0];
  else if (byType("document")[0]) focus = byType("document")[0];
  else if (selected) {
    focus = selected;
    usedSelectionContext = true;
  } else if (byType("machine")[0]) focus = byType("machine")[0];

  const highlight = new Set<string>(matches.map((m) => m.id));
  const related: string[] = [];
  if (focus) {
    highlight.add(focus.id);
    if (symptom && !component) {
      for (const c of componentsForSymptom(graph, symptom.id)) related.push(c.id);
    }
    if (focus.type === "component") {
      if (intent === "procedure") {
        related.push(...getRelatedIds(graph.links, focus.id, "INSPECT_USING"));
        related.push(...getRelatedIds(graph.links, focus.id, "DOCUMENTED_IN"));
      } else if (intent === "relationship") {
        related.push(...getRelatedIds(graph.links, focus.id, "CONNECTED_TO", "both"));
      } else if (intent === "diagnostic" && !symptom) {
        related.push(...getRelatedIds(graph.links, focus.id, "MAY_CAUSE"));
        related.push(...getRelatedIds(graph.links, focus.id, "INSPECT_USING"));
      } else if (intent === "explanation" || intent === "general") {
        related.push(...getNeighborIds(graph.links, focus.id));
      }
    } else if (focus.type === "system") {
      related.push(...getRelatedIds(graph.links, focus.id, "HAS_COMPONENT"));
    } else if (focus.type === "symptom") {
      related.push(...getRelatedIds(graph.links, focus.id, "MAY_CAUSE", "in"));
    } else {
      related.push(...getNeighborIds(graph.links, focus.id));
    }
  }
  related.forEach((id) => highlight.add(id));

  // Component-aware query expansion.
  const expansionNames: string[] = [];
  if (symptom) expansionNames.push(symptom.name);
  if (focus) expansionNames.push(focus.name);
  if (symptom && !component) {
    expansionNames.push(...componentsForSymptom(graph, symptom.id).slice(0, 3).map((c) => c.name));
  }
  const system = focus ? findOwningSystem(graph, focus.id) : undefined;
  if (system && focus?.type !== "machine") expansionNames.push(system.name);

  const queryWords = new Set(tokenize(query));
  const extra: string[] = [];
  const seenExtra = new Set<string>();
  for (const term of [...expansionNames, INTENT_SUFFIX[intent]]) {
    for (const word of tokenize(term)) {
      if (queryWords.has(word) || seenExtra.has(word)) continue;
      seenExtra.add(word);
      extra.push(word);
    }
  }
  const baseQuery = query.trim().replace(/[?!.]+$/g, "");
  const expandedQuery = extra.length ? `${baseQuery} ${extra.join(" ")}` : baseQuery;

  const keyTerms = [
    ...new Set(
      [...matches.map((m) => m.name), ...(focus ? [focus.name] : []), ...(symptom ? [symptom.name] : [])]
        .flatMap(tokenize)
        .filter((w) => !STOPWORDS.has(w)),
    ),
  ];
  const queryTerms = [...queryWords].filter((w) => w.length > 2 && !STOPWORDS.has(w) && !keyTerms.includes(w));

  return {
    intent,
    matchedNodeIds: matches.map((m) => m.id),
    focusNodeId: focus?.id ?? null,
    highlightNodeIds: [...highlight],
    usedSelectionContext,
    expandedQuery,
    keyTerms,
    queryTerms,
    graphContext: describeGraphContext(graph, focus, symptom, intent),
  };
}

/** One or two sentences stating what the seeded graph links to the focus node. */
function describeGraphContext(
  graph: KnowledgeGraph,
  focus: KnowledgeNode | undefined,
  symptom: KnowledgeNode | undefined,
  intent: Intent,
): string {
  if (!focus) return "";
  const parts: string[] = [];
  if (symptom) {
    const causes = componentsForSymptom(graph, symptom.id).map((c) => c.name);
    if (causes.length) parts.push(`${symptom.name} is linked to ${joinNames(causes)} as possible causes.`);
  }
  if (focus.type === "component") {
    const connected = namesOf(graph, getRelatedIds(graph.links, focus.id, "CONNECTED_TO", "both"));
    const symptoms = namesOf(graph, getRelatedIds(graph.links, focus.id, "MAY_CAUSE"));
    const procedures = namesOf(graph, getRelatedIds(graph.links, focus.id, "INSPECT_USING"));
    const docs = namesOf(graph, getRelatedIds(graph.links, focus.id, "DOCUMENTED_IN"));
    if (intent === "relationship" || intent === "explanation" || intent === "general") {
      if (connected.length) parts.push(`${focus.name} is connected to ${joinNames(connected)}.`);
    }
    if (!symptom && symptoms.length && intent !== "relationship") {
      parts.push(`${focus.name} may cause ${joinNames(symptoms)}.`);
    }
    if (procedures.length && intent !== "relationship") {
      parts.push(`Listed inspection ${procedures.length > 1 ? "procedures" : "procedure"}: ${joinNames(procedures)}.`);
    }
    if (docs.length && intent === "procedure") parts.push(`Documented in ${joinNames(docs)}.`);
    const inspection = focus.metadata?.inspection;
    if (intent === "procedure" && typeof inspection === "string") parts.push(inspection);
  } else if (focus.type === "system") {
    const components = namesOf(graph, getRelatedIds(graph.links, focus.id, "HAS_COMPONENT"));
    if (components.length) parts.push(`${focus.name} contains ${joinNames(components)}.`);
  } else if (!symptom) {
    parts.push(focus.description);
  }
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* Normalisation, ranking, evidence                                    */
/* ------------------------------------------------------------------ */

/** Merge results that point at the same page, remembering every provider that returned it. */
export function dedupeSources(sources: SourceResult[]): SourceResult[] {
  const byUrl = new Map<string, SourceResult>();
  for (const s of sources) {
    const key = canonicalUrl(s.url);
    if (!key) continue;
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, { ...s });
      continue;
    }
    if (s.provider !== existing.provider && !existing.alsoFoundBy?.includes(s.provider)) {
      existing.alsoFoundBy = [...(existing.alsoFoundBy ?? []), s.provider];
    }
    if (s.snippet.length > existing.snippet.length) existing.snippet = s.snippet;
  }
  return [...byUrl.values()];
}

const KEY_WEIGHT = 2;
export const EVIDENCE_THRESHOLD = 0.34;
export const MAX_EVIDENCE = 4;

function overlapScore(text: string, keyTerms: string[], queryTerms: string[]): number {
  const total = keyTerms.length * KEY_WEIGHT + queryTerms.length;
  if (!total) return 0;
  const words = new Set(tokenize(text));
  const has = (term: string) => words.has(term) || words.has(`${term}s`) || (term.endsWith("s") && words.has(term.slice(0, -1)));
  let hit = 0;
  for (const t of keyTerms) if (has(t)) hit += KEY_WEIGHT;
  for (const t of queryTerms) if (has(t)) hit += 1;
  return hit / total;
}

/**
 * Score each source by how many of the question's terms its title and snippet contain
 * (graph-derived component/symptom terms count double), with a small bonus when more than
 * one provider independently returned the page. Sorted best first.
 */
export function rankSources(
  sources: SourceResult[],
  analysis: Pick<QueryAnalysis, "keyTerms" | "queryTerms">,
  extraText: Map<string, string> = new Map(),
): SourceResult[] {
  return sources
    .map((s) => {
      const text = `${s.title} ${s.snippet} ${extraText.get(s.id) ?? ""}`;
      let score = overlapScore(text, analysis.keyTerms, analysis.queryTerms);
      if (s.alsoFoundBy?.length) score += 0.08;
      return { ...s, score: Math.round(Math.min(1, score) * 100) / 100 };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (a.providerRank ?? 99) - (b.providerRank ?? 99));
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 420 && /[a-z]/.test(s));
}

/** Pick the passage (one or two adjacent sentences) that best covers the question's terms. */
export function bestQuote(text: string, keyTerms: string[], queryTerms: string[]): { quote: string; score: number } | null {
  const sentences = splitSentences(text).slice(0, 80);
  if (!sentences.length) {
    const t = text.replace(/\s+/g, " ").trim();
    if (t.length < 40) return null;
    return { quote: t.slice(0, 300), score: overlapScore(t, keyTerms, queryTerms) };
  }
  let best = { quote: sentences[0], score: -1 };
  for (let i = 0; i < sentences.length; i++) {
    const single = overlapScore(sentences[i], keyTerms, queryTerms);
    if (single > best.score) best = { quote: sentences[i], score: single };
    if (i + 1 < sentences.length && sentences[i].length + sentences[i + 1].length < 380) {
      const pair = `${sentences[i]} ${sentences[i + 1]}`;
      const s = overlapScore(pair, keyTerms, queryTerms);
      if (s > best.score + 0.1) best = { quote: pair, score: s };
    }
  }
  return best;
}

export function selectEvidence(
  ranked: SourceResult[],
  analysis: Pick<QueryAnalysis, "keyTerms" | "queryTerms">,
  extraText: Map<string, string> = new Map(),
): Evidence[] {
  const out: Evidence[] = [];
  for (const s of ranked) {
    if (out.length >= MAX_EVIDENCE) break;
    if ((s.score ?? 0) < EVIDENCE_THRESHOLD) continue;
    const full = extraText.get(s.id);
    const fromFull = full ? bestQuote(full, analysis.keyTerms, analysis.queryTerms) : null;
    const fromSnippet = bestQuote(s.snippet, analysis.keyTerms, analysis.queryTerms);
    const pick = fromFull && (!fromSnippet || fromFull.score >= fromSnippet.score) ? fromFull : fromSnippet;
    if (!pick || pick.score <= 0) continue;
    out.push({ sourceId: s.id, quote: pick.quote, score: Math.round(pick.score * 100) / 100 });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

export type RetrievalDeps = {
  telemConfigured: boolean;
  tavilyConfigured: boolean;
  telemSearch: (query: string, strategy: TelemStrategy) => Promise<TelemSearchResult>;
  telemFetch: (urls: string[]) => Promise<TelemFetchResult>;
  tavilySearch: (query: string) => Promise<TavilySearchResult>;
  explain?: (input: { query: string; graphContext: string; evidence: LlmEvidence[] }) => Promise<string | null>;
  graph?: KnowledgeGraph;
  now?: () => number;
};

function callFromError(service: RetrievalCall["service"], err: unknown, latencyMs: number, strategy?: string): RetrievalCall {
  const kind = err instanceof RetrievalError ? err.kind : "upstream";
  // Only messages composed by this app are forwarded; raw upstream errors stay in server logs.
  const message = err instanceof RetrievalError ? err.message : "Request failed.";
  return {
    service,
    status: kind === "timeout" ? "timeout" : "error",
    latencyMs,
    resultCount: 0,
    strategy,
    error: message,
  };
}

async function runTelemSearch(
  deps: RetrievalDeps,
  query: string,
  strategy: TelemStrategy,
  now: () => number,
): Promise<{ call: RetrievalCall; sources: SourceResult[]; error?: RetrievalError }> {
  const started = now();
  try {
    const r = await deps.telemSearch(query, strategy);
    return {
      sources: r.sources,
      call: {
        service: "telem-search",
        status: r.sources.length ? "ok" : "empty",
        latencyMs: r.latencyMs,
        resultCount: r.sources.length,
        strategy: r.strategy,
        routedProviders: r.routedProviders,
        providers: r.providers,
        interactionId: r.interactionId,
      },
    };
  } catch (err) {
    const strategyText = strategy === "auto" ? "auto_routing: accuracy" : "pinned: exa, brave";
    return {
      sources: [],
      call: callFromError("telem-search", err, now() - started, strategyText),
      error: err instanceof RetrievalError ? err : new RetrievalError("upstream", "Telem search failed."),
    };
  }
}

async function runTavily(
  deps: RetrievalDeps,
  query: string,
  now: () => number,
): Promise<{ call: RetrievalCall; sources: SourceResult[] }> {
  const started = now();
  try {
    const r = await deps.tavilySearch(query);
    return {
      sources: r.sources,
      call: {
        service: "tavily-direct",
        status: r.sources.length ? "ok" : "empty",
        latencyMs: r.latencyMs,
        resultCount: r.sources.length,
        strategy: "direct SDK call, searchDepth: advanced",
        providers: [{ name: "tavily", status: "succeeded", resultCount: r.sources.length }],
      },
    };
  } catch (err) {
    return { sources: [], call: callFromError("tavily-direct", err, now() - started) };
  }
}

/** Source-document nodes for the graph. Only evidence-bearing sources become nodes. */
export function buildSourceNodes(
  sources: SourceResult[],
  evidence: Evidence[],
  attachToId: string | null,
  graph: KnowledgeGraph,
): { newNodes: KnowledgeNode[]; newLinks: KnowledgeLink[] } {
  if (!attachToId || !getNodeById(graph.nodes, attachToId)) return { newNodes: [], newLinks: [] };
  const existing = new Set(graph.nodes.map((n) => n.id));
  const newNodes: KnowledgeNode[] = [];
  const newLinks: KnowledgeLink[] = [];
  for (const e of evidence) {
    const s = sources.find((x) => x.id === e.sourceId);
    if (!s) continue;
    const id = sourceNodeId(s.url);
    if (existing.has(id)) continue;
    existing.add(id);
    const title = s.title.length > 64 ? `${s.title.slice(0, 63).trimEnd()}…` : s.title;
    newNodes.push({
      id,
      name: title,
      type: "document",
      description: e.quote,
      sourceIds: [s.id],
      metadata: {
        dynamic: true,
        url: s.url,
        host: hostOf(s.url),
        provider: s.provider,
        via: s.via,
        relevance: s.score,
      },
    });
    newLinks.push({ source: attachToId, target: id, relation: "DOCUMENTED_IN" });
  }
  return { newNodes, newLinks };
}

function spokenQuote(quote: string): string {
  const q = quote.replace(/\[[^\]]*\]|\(https?:[^)]*\)|https?:\S+/g, "").replace(/\s+/g, " ").trim();
  if (q.length <= 220) return q;
  const cut = q.slice(0, 220);
  const stop = cut.lastIndexOf(". ");
  return stop > 80 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

type Composed = Pick<SearchResponse, "answer" | "spokenAnswer" | "answerMode" | "evidenceStatus">;

async function composeAnswer(
  deps: RetrievalDeps,
  query: string,
  analysis: QueryAnalysis,
  ranked: SourceResult[],
  evidence: Evidence[],
  state: { attempted: boolean; configured: boolean; skipped: boolean; failed: boolean },
): Promise<Composed> {
  const graphSpoken = analysis.graphContext ? `In the demo graph, ${lowerFirst(analysis.graphContext)}` : "";

  if (state.skipped) {
    return {
      answer: analysis.graphContext
        ? "This is a question about how parts of the machine relate, so it is answered from the knowledge graph. No web search was run."
        : "No matching component was found in the knowledge graph for this question.",
      spokenAnswer: analysis.graphContext || "I could not find a matching component in the graph.",
      answerMode: "graph-only",
      evidenceStatus: "not_needed",
    };
  }
  if (!state.configured) {
    return {
      answer:
        "Live search is not configured, so no web sources were retrieved. Showing what the synthetic demo graph contains. Add TELEM_API_KEY to enable live retrieval.",
      spokenAnswer: graphSpoken || "Live search is not configured, and no matching component was found.",
      answerMode: "graph-only",
      evidenceStatus: "not_configured",
    };
  }
  if (!ranked.length) {
    return {
      answer: state.failed
        ? "Live search failed, so there is no source evidence for this question. See Search Intelligence for the error. The demo graph context below is synthetic and unverified."
        : "Live search returned no sources for this question. The demo graph context below is synthetic and unverified.",
      spokenAnswer: `Live search returned no sources. ${graphSpoken}`.trim(),
      answerMode: "graph-only",
      evidenceStatus: "none",
    };
  }
  if (!evidence.length) {
    return {
      answer: `Retrieved ${ranked.length} source${ranked.length === 1 ? "" : "s"}, but none contained text that clearly addresses this question. Evidence is incomplete, so no technical claim is made. The sources are listed for manual review.`,
      spokenAnswer: `I found sources, but none clearly answer this, so the evidence is incomplete. ${graphSpoken}`.trim(),
      answerMode: "extractive",
      evidenceStatus: "incomplete",
    };
  }

  const cited = evidence
    .map((e, i) => ({ e, i, s: ranked.find((x) => x.id === e.sourceId) }))
    .filter((x): x is { e: Evidence; i: number; s: SourceResult } => !!x.s);
  const top = cited[0];
  const spokenExtract = `${graphSpoken} The top retrieved source, from ${hostOf(top.s.url)}, says: ${spokenQuote(top.e.quote)}`.trim();

  if (deps.explain) {
    const text = await deps.explain({
      query,
      graphContext: analysis.graphContext,
      evidence: cited.map(({ e, i, s }) => ({ index: i + 1, title: s.title, host: hostOf(s.url), quote: e.quote })),
    });
    if (text) {
      return {
        answer: text,
        spokenAnswer: text.replace(/\s*\[\d+\]/g, "").slice(0, 600),
        answerMode: "llm",
        evidenceStatus: "sufficient",
      };
    }
  }

  return {
    answer: `Found ${cited.length} relevant passage${cited.length === 1 ? "" : "s"} in ${ranked.length} retrieved source${ranked.length === 1 ? "" : "s"}. The quotes below are taken verbatim from those sources. They describe comparable equipment, not this demo machine.`,
    spokenAnswer: spokenExtract,
    answerMode: "extractive",
    evidenceStatus: "sufficient",
  };
}

function lowerFirst(text: string): string {
  // Keep proper node names capitalised; only soften a leading article.
  return text.replace(/^(The|A|An) /, (m) => m.toLowerCase());
}

/**
 * Main search pipeline:
 * intent → graph matching → Telem (auto-routed, then pinned providers) → Tavily fallback →
 * de-duplication → ranking → page fetch for fuller text → evidence selection → answer.
 */
export async function runSearchPipeline(
  input: { query: string; selectedNodeId?: string | null; mode?: "normal" | "expand" },
  deps: RetrievalDeps,
): Promise<SearchResponse> {
  const now = deps.now ?? Date.now;
  const started = now();
  const graph = deps.graph ?? SEED_GRAPH;
  const mode = input.mode ?? "normal";
  const analysis = analyzeQuery(input.query, input.selectedNodeId, graph);
  const calls: RetrievalCall[] = [];
  const anyConfigured = deps.telemConfigured || deps.tavilyConfigured;

  // Search routing: graph-relationship questions are answered locally and never hit the network.
  const skipWeb = mode === "normal" && analysis.intent === "relationship";

  let sources: SourceResult[] = [];
  let primary: SearchResponse["searchMetadata"]["primaryProvider"] = "none";
  let fallbackUsed = false;
  let fallbackReason: string | undefined;
  let failed = false;
  const fullText = new Map<string, string>();

  if (!skipWeb && anyConfigured) {
    let telemProblem: string | undefined;

    if (deps.telemConfigured) {
      primary = "telem";
      let attempt = await runTelemSearch(deps, analysis.expandedQuery, "auto", now);
      calls.push(attempt.call);
      const retryable =
        (attempt.error && (attempt.error.kind === "bad_request" || attempt.error.kind === "upstream")) ||
        (!attempt.error && attempt.sources.length === 0);
      if (retryable) {
        // Auto-routing was rejected or came back empty: pin two known providers and try once more.
        attempt = await runTelemSearch(deps, analysis.expandedQuery, "pinned", now);
        calls.push(attempt.call);
      }
      if (attempt.error) {
        telemProblem = `Telem failed: ${attempt.error.message}`;
        failed = true;
      } else {
        sources = rankSources(dedupeSources(attempt.sources), analysis);
        if (!sources.length) telemProblem = "Telem returned no results";
        else if (!sources.some((s) => (s.score ?? 0) >= EVIDENCE_THRESHOLD)) {
          telemProblem = "Telem results did not contain evidence relevant to the question";
        }
      }
    } else {
      telemProblem = "Telem is not configured";
    }

    if (telemProblem) {
      if (deps.tavilyConfigured) {
        const t = await runTavily(deps, analysis.expandedQuery, now);
        calls.push(t.call);
        fallbackUsed = true;
        fallbackReason = telemProblem;
        if (t.sources.length) {
          sources = rankSources(dedupeSources([...sources, ...t.sources]), analysis);
          failed = false;
          if (primary === "none") primary = "tavily";
        } else if (t.call.status !== "ok" && t.call.status !== "empty" && !sources.length) {
          failed = true;
        }
      } else {
        fallbackReason = `${telemProblem}. Tavily fallback is unavailable (TAVILY_API_KEY not set)`;
      }
    }

    // Pull fuller page text through Telem for the most relevant Telem-sourced results.
    const fetchTargets = sources
      .filter((s) => s.via === "telem" && (s.score ?? 0) >= EVIDENCE_THRESHOLD)
      .slice(0, 2);
    if (deps.telemConfigured && mode === "normal" && fetchTargets.length) {
      const fetchStarted = now();
      try {
        const fetched = await deps.telemFetch(fetchTargets.map((s) => s.url));
        let ok = 0;
        for (const page of fetched.pages) {
          if (!page.ok) continue;
          const key = canonicalUrl(page.url);
          const target = fetchTargets.find((s) => canonicalUrl(s.url) === key);
          if (!target) continue;
          fullText.set(target.id, page.content);
          ok++;
        }
        calls.push({
          service: "telem-fetch",
          status: ok ? "ok" : "empty",
          latencyMs: fetched.latencyMs,
          resultCount: ok,
          strategy: `page text for the top ${fetchTargets.length} ranked source${fetchTargets.length === 1 ? "" : "s"}`,
          providers: fetched.pages
            .filter((p) => p.provider)
            .map((p) => ({ name: p.provider as string, status: p.ok ? "succeeded" : "failed", resultCount: p.ok ? 1 : 0 })),
        });
        if (ok) {
          sources = rankSources(
            sources.map((s) => (fullText.has(s.id) ? { ...s, fullTextFetched: true } : s)),
            analysis,
            new Map([...fullText].map(([id, text]) => [id, text.slice(0, 3000)])),
          );
        }
      } catch (err) {
        calls.push(callFromError("telem-fetch", err, now() - fetchStarted));
      }
    }
  }

  const evidence = selectEvidence(sources, analysis, fullText);
  const composed = await composeAnswer(deps, input.query, analysis, sources, evidence, {
    attempted: calls.length > 0,
    configured: anyConfigured,
    skipped: skipWeb,
    failed,
  });

  // When expanding, new source nodes attach to the node the user expanded, not to an inferred focus.
  const expandedNode = mode === "expand" ? getNodeById(graph.nodes, input.selectedNodeId) : undefined;
  const focusNodeId = expandedNode?.id ?? analysis.focusNodeId;
  const { newNodes, newLinks } =
    mode === "expand" ? buildSourceNodes(sources, evidence, focusNodeId, graph) : { newNodes: [], newLinks: [] };

  return {
    query: input.query,
    expandedQuery: analysis.expandedQuery,
    intent: analysis.intent,
    ...composed,
    graphContext: analysis.graphContext,
    focusNodeId,
    highlightNodeIds: [...new Set([...analysis.highlightNodeIds, ...(focusNodeId ? [focusNodeId] : [])])],
    matchedNodeIds: analysis.matchedNodeIds,
    newNodes,
    newLinks,
    sources,
    evidence,
    searchMetadata: {
      primaryProvider: primary,
      fallbackUsed,
      fallbackReason,
      latencyMs: now() - started,
      mode: anyConfigured ? "live" : "demo",
      calls,
      note: skipWeb ? "Routed to the knowledge graph. No external search call was made." : undefined,
    },
  };
}

/** Explicit Deep Research: one direct Tavily call, independent of Telem. */
export async function runDeepResearch(
  input: { query: string; selectedNodeId?: string | null },
  deps: RetrievalDeps,
): Promise<SearchResponse> {
  const now = deps.now ?? Date.now;
  const started = now();
  const graph = deps.graph ?? SEED_GRAPH;
  const analysis = analyzeQuery(input.query, input.selectedNodeId, graph);
  const calls: RetrievalCall[] = [];
  let sources: SourceResult[] = [];
  let failed = false;

  if (deps.tavilyConfigured) {
    const t = await runTavily(deps, analysis.expandedQuery, now);
    calls.push(t.call);
    failed = t.call.status === "error" || t.call.status === "timeout";
    sources = rankSources(dedupeSources(t.sources), analysis);
  }

  const evidence = selectEvidence(sources, analysis);
  const composed = await composeAnswer(deps, input.query, analysis, sources, evidence, {
    attempted: calls.length > 0,
    configured: deps.tavilyConfigured,
    skipped: false,
    failed,
  });
  const { newNodes, newLinks } = buildSourceNodes(sources, evidence, analysis.focusNodeId, graph);

  return {
    query: input.query,
    expandedQuery: analysis.expandedQuery,
    intent: analysis.intent,
    ...composed,
    answer: deps.tavilyConfigured
      ? composed.answer
      : "Deep Research uses a direct Tavily call, and TAVILY_API_KEY is not set. No request was made.",
    graphContext: analysis.graphContext,
    focusNodeId: analysis.focusNodeId,
    highlightNodeIds: analysis.highlightNodeIds,
    matchedNodeIds: analysis.matchedNodeIds,
    newNodes,
    newLinks,
    sources,
    evidence,
    searchMetadata: {
      primaryProvider: deps.tavilyConfigured ? "tavily" : "none",
      fallbackUsed: false,
      latencyMs: now() - started,
      mode: deps.tavilyConfigured ? "live" : "demo",
      calls,
      note: "Deep Research: direct Tavily request, separate from Telem routing.",
    },
  };
}
