import { z } from "zod";

/* ---------- Knowledge graph ---------- */

export const NODE_TYPES = [
  "machine",
  "system",
  "component",
  "symptom",
  "document",
  "procedure",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const RELATIONS = [
  "HAS_SYSTEM",
  "HAS_COMPONENT",
  "CONNECTED_TO",
  "MAY_CAUSE",
  "DOCUMENTED_IN",
  "INSPECT_USING",
] as const;
export type Relation = (typeof RELATIONS)[number];

export type KnowledgeNode = {
  id: string;
  name: string;
  type: NodeType;
  description: string;
  metadata?: Record<string, unknown>;
  sourceIds?: string[];
  x?: number;
  y?: number;
  z?: number;
};

export type KnowledgeLink = {
  source: string;
  target: string;
  relation: Relation;
};

export type KnowledgeGraph = { nodes: KnowledgeNode[]; links: KnowledgeLink[] };

export const knowledgeNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(NODE_TYPES),
  description: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sourceIds: z.array(z.string()).optional(),
});

export const knowledgeLinkSchema = z.object({
  source: z.string(),
  target: z.string(),
  relation: z.enum(RELATIONS),
});

/* ---------- Retrieval ---------- */

/** How a source reached the app. Telem-routed provider calls and direct Tavily calls stay separate. */
export const RETRIEVAL_VIAS = ["telem", "tavily-direct"] as const;
export type RetrievalVia = (typeof RETRIEVAL_VIAS)[number];

export const sourceResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  /** Upstream search provider that supplied the result (e.g. "exa", "brave", "tavily"). */
  provider: z.string(),
  /** Relevance to the query, computed by repAIr's ranker (0..1). Not a provider score. */
  score: z.number().optional(),
  via: z.enum(RETRIEVAL_VIAS),
  /** Rank position reported by the provider, when present. */
  providerRank: z.number().optional(),
  /** Score reported by the provider itself (Tavily returns one), when present. */
  providerScore: z.number().optional(),
  /** Other providers that returned the same URL (merged during de-duplication). */
  alsoFoundBy: z.array(z.string()).optional(),
  publishedDate: z.string().optional(),
  /** True when fuller page text was retrieved through Telem's /v1/fetch. */
  fullTextFetched: z.boolean().optional(),
});
export type SourceResult = z.infer<typeof sourceResultSchema>;

export const INTENTS = [
  "diagnostic",
  "procedure",
  "relationship",
  "explanation",
  "general",
] as const;
export type Intent = (typeof INTENTS)[number];

export const providerRunSchema = z.object({
  name: z.string(),
  status: z.string(),
  /** Latency reported by Telem for this provider run. */
  latencyMs: z.number().optional(),
  resultCount: z.number(),
  error: z.string().optional(),
});
export type ProviderRun = z.infer<typeof providerRunSchema>;

export const retrievalCallSchema = z.object({
  service: z.enum(["telem-search", "telem-fetch", "tavily-direct"]),
  status: z.enum(["ok", "empty", "error", "timeout"]),
  /** Wall-clock time measured by repAIr around the request. */
  latencyMs: z.number(),
  resultCount: z.number(),
  /** Request strategy sent by repAIr, e.g. "auto_routing: accuracy" or "pinned: exa, brave". */
  strategy: z.string().optional(),
  /** Providers Telem's router selected (from the response `routing` field), when returned. */
  routedProviders: z.array(z.string()).optional(),
  providers: z.array(providerRunSchema).optional(),
  interactionId: z.string().optional(),
  error: z.string().optional(),
});
export type RetrievalCall = z.infer<typeof retrievalCallSchema>;

export const evidenceSchema = z.object({
  sourceId: z.string(),
  quote: z.string(),
  score: z.number(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const MAX_QUERY_LENGTH = 300;

const querySchema = z.string().trim().min(2).max(MAX_QUERY_LENGTH);
const nodeIdSchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9_]+$/)
  .nullish();

export const searchRequestSchema = z.object({
  query: querySchema,
  selectedNodeId: nodeIdSchema,
  mode: z.enum(["normal", "expand"]).default("normal"),
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;

export const researchRequestSchema = z.object({
  query: querySchema,
  selectedNodeId: nodeIdSchema,
});
export type ResearchRequest = z.infer<typeof researchRequestSchema>;

export const searchResponseSchema = z.object({
  query: z.string(),
  expandedQuery: z.string(),
  intent: z.enum(INTENTS),
  /** Statement about what the retrieved evidence does (or does not) support. */
  answer: z.string(),
  /** Short version suitable for speech synthesis. */
  spokenAnswer: z.string(),
  /** extractive = quotes lifted from sources; llm = optional LLM summary of those quotes; graph-only = no web evidence. */
  answerMode: z.enum(["graph-only", "extractive", "llm"]),
  evidenceStatus: z.enum(["sufficient", "incomplete", "none", "not_configured", "not_needed"]),
  /** What the seeded synthetic graph says. Never presented as a verified web finding. */
  graphContext: z.string(),
  focusNodeId: z.string().nullable(),
  highlightNodeIds: z.array(z.string()),
  matchedNodeIds: z.array(z.string()),
  newNodes: z.array(knowledgeNodeSchema),
  newLinks: z.array(knowledgeLinkSchema),
  sources: z.array(sourceResultSchema),
  evidence: z.array(evidenceSchema),
  searchMetadata: z.object({
    primaryProvider: z.enum(["telem", "tavily", "none"]),
    fallbackUsed: z.boolean(),
    fallbackReason: z.string().optional(),
    /** Total pipeline time measured by repAIr. */
    latencyMs: z.number(),
    mode: z.enum(["live", "demo"]),
    calls: z.array(retrievalCallSchema),
    note: z.string().optional(),
  }),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  telemConfigured: z.boolean(),
  tavilyConfigured: z.boolean(),
  llmConfigured: z.boolean(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export type ApiError = { error: string };
