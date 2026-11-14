import type { KnowledgeGraph, KnowledgeLink, KnowledgeNode, NodeType, Relation } from "./types";

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

export function getNodeById(nodes: KnowledgeNode[], id: string | null | undefined): KnowledgeNode | undefined {
  if (!id) return undefined;
  return nodes.find((n) => n.id === id);
}

export function nodeAliases(node: KnowledgeNode): string[] {
  const aliases = node.metadata?.aliases;
  const extra = Array.isArray(aliases) ? aliases.filter((a): a is string => typeof a === "string") : [];
  return [node.name, ...extra];
}

export type NodeMatch = {
  node: KnowledgeNode;
  phrase: string;
  /** Word index of the match start within the tokenized text. */
  start: number;
  /** Number of words matched. */
  length: number;
};

const TYPE_PRIORITY: Record<NodeType, number> = {
  component: 0,
  symptom: 1,
  system: 2,
  procedure: 3,
  document: 4,
  machine: 5,
};

/**
 * Find graph nodes mentioned in free text. Whole-word phrase matching over names and aliases;
 * longer phrases win and matches never overlap ("engine overheating" does not also match "engine").
 * Returned in order of appearance.
 */
export function matchNodesInText(nodes: KnowledgeNode[], text: string): NodeMatch[] {
  const words = tokenize(text);
  if (!words.length) return [];

  const candidates: NodeMatch[] = [];
  for (const node of nodes) {
    for (const alias of nodeAliases(node)) {
      const phrase = tokenize(alias);
      if (!phrase.length || phrase.length > words.length) continue;
      for (let i = 0; i + phrase.length <= words.length; i++) {
        let hit = true;
        for (let j = 0; j < phrase.length; j++) {
          if (words[i + j] !== phrase[j]) {
            hit = false;
            break;
          }
        }
        if (hit) candidates.push({ node, phrase: phrase.join(" "), start: i, length: phrase.length });
      }
    }
  }

  candidates.sort(
    (a, b) =>
      b.length - a.length ||
      TYPE_PRIORITY[a.node.type] - TYPE_PRIORITY[b.node.type] ||
      a.start - b.start,
  );

  const taken = new Array<boolean>(words.length).fill(false);
  const seen = new Set<string>();
  const accepted: NodeMatch[] = [];
  for (const c of candidates) {
    let free = true;
    for (let i = c.start; i < c.start + c.length; i++) if (taken[i]) free = false;
    if (!free) continue;
    for (let i = c.start; i < c.start + c.length; i++) taken[i] = true;
    if (seen.has(c.node.id)) continue;
    seen.add(c.node.id);
    accepted.push(c);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

/** Resolve a spoken or typed name to a node: exact name/alias first, then the longest phrase match. */
export function findNodeByName(nodes: KnowledgeNode[], text: string): KnowledgeNode | undefined {
  const target = normalize(text);
  if (!target) return undefined;
  for (const node of nodes) {
    if (nodeAliases(node).some((a) => normalize(a) === target)) return node;
  }
  const matches = matchNodesInText(nodes, text);
  if (!matches.length) return undefined;
  return [...matches].sort((a, b) => b.length - a.length || a.start - b.start)[0].node;
}

export function getNeighborIds(links: KnowledgeLink[], id: string): Set<string> {
  const out = new Set<string>();
  for (const l of links) {
    if (l.source === id) out.add(l.target);
    else if (l.target === id) out.add(l.source);
  }
  return out;
}

/** Ids reached from `id` over `relation`. "out" follows source→target, "in" the reverse. Link order is preserved. */
export function getRelatedIds(
  links: KnowledgeLink[],
  id: string,
  relation: Relation,
  direction: "out" | "in" | "both" = "out",
): string[] {
  const out: string[] = [];
  for (const l of links) {
    if (l.relation !== relation) continue;
    if ((direction === "out" || direction === "both") && l.source === id) out.push(l.target);
    if ((direction === "in" || direction === "both") && l.target === id) out.push(l.source);
  }
  return [...new Set(out)];
}

export function getNeighborsByType(graph: KnowledgeGraph, id: string, type: NodeType): KnowledgeNode[] {
  const ids = getNeighborIds(graph.links, id);
  return graph.nodes.filter((n) => ids.has(n.id) && n.type === type);
}

/** Components listed as possible causes of a symptom, primary suspect first. */
export function componentsForSymptom(graph: KnowledgeGraph, symptomId: string): KnowledgeNode[] {
  return getRelatedIds(graph.links, symptomId, "MAY_CAUSE", "in")
    .map((id) => getNodeById(graph.nodes, id))
    .filter((n): n is KnowledgeNode => !!n && n.type === "component");
}

export function findOwningSystem(graph: KnowledgeGraph, id: string): KnowledgeNode | undefined {
  const node = getNodeById(graph.nodes, id);
  if (!node) return undefined;
  if (node.type === "system") return node;
  const direct = getRelatedIds(graph.links, id, "HAS_COMPONENT", "in")[0];
  if (direct) return getNodeById(graph.nodes, direct);
  for (const nid of getNeighborIds(graph.links, id)) {
    const parent = getRelatedIds(graph.links, nid, "HAS_COMPONENT", "in")[0];
    if (parent) return getNodeById(graph.nodes, parent);
  }
  return undefined;
}

/** A system, its machine, its components and everything attached to those components. */
export function getSystemSubgraphIds(graph: KnowledgeGraph, systemId: string): Set<string> {
  const ids = new Set<string>([systemId]);
  for (const m of getRelatedIds(graph.links, systemId, "HAS_SYSTEM", "in")) ids.add(m);
  for (const d of getRelatedIds(graph.links, systemId, "DOCUMENTED_IN", "out")) ids.add(d);
  for (const c of getRelatedIds(graph.links, systemId, "HAS_COMPONENT", "out")) {
    ids.add(c);
    for (const rel of ["MAY_CAUSE", "DOCUMENTED_IN", "INSPECT_USING"] as const) {
      for (const t of getRelatedIds(graph.links, c, rel, "out")) ids.add(t);
    }
  }
  return ids;
}

export const linkKey = (l: KnowledgeLink): string => `${l.source}|${l.relation}|${l.target}`;

/**
 * Add nodes and links without creating duplicates. Links whose endpoints are not both present
 * are skipped, so the full seed link list can be offered every time and only fitting links land.
 */
export function mergeGraph(
  base: KnowledgeGraph,
  addNodes: KnowledgeNode[],
  addLinks: KnowledgeLink[],
): KnowledgeGraph & { addedNodeIds: string[] } {
  const nodeIds = new Set(base.nodes.map((n) => n.id));
  const nodes = [...base.nodes];
  const addedNodeIds: string[] = [];
  for (const n of addNodes) {
    if (nodeIds.has(n.id)) continue;
    nodeIds.add(n.id);
    nodes.push(n);
    addedNodeIds.push(n.id);
  }
  const keys = new Set(base.links.map(linkKey));
  const links = [...base.links];
  for (const l of addLinks) {
    const k = linkKey(l);
    if (keys.has(k) || !nodeIds.has(l.source) || !nodeIds.has(l.target)) continue;
    keys.add(k);
    links.push({ source: l.source, target: l.target, relation: l.relation });
  }
  return { nodes, links, addedNodeIds };
}

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|ref_src$)/i;

/** Canonical form used to de-duplicate sources returned by different providers. */
export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    u.searchParams.sort();
    const path = u.pathname.replace(/\/+$/, "");
    const qs = u.searchParams.toString();
    return `${u.hostname}${path}${qs ? `?${qs}` : ""}`;
  } catch {
    return null;
  }
}

/** FNV-1a, hex. Deterministic across server and client. */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Stable id for a source document node: the same URL always maps to the same node. */
export function sourceNodeId(url: string): string {
  return `src_${hashString(canonicalUrl(url) ?? url)}`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
