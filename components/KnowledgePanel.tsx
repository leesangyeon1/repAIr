"use client";

import { ExternalLink, Expand, MessageCircleQuestion, MousePointerClick } from "lucide-react";
import { NODE_STYLE } from "@/lib/graph-data";
import { getNodeById, getRelatedIds, hostOf } from "@/lib/graph-utils";
import type { KnowledgeGraph, KnowledgeNode, SearchResponse } from "@/lib/types";

type Props = {
  node: KnowledgeNode | null;
  /** Every known node and link (seeded + retrieved), including ones not yet revealed in 3D. */
  graph: KnowledgeGraph;
  result: SearchResponse | null;
  busy: boolean;
  onSelectNode: (id: string) => void;
  onExpand: (id: string) => void;
  onAsk: (node: KnowledgeNode) => void;
};

function NodeChips({ nodes, onSelect }: { nodes: KnowledgeNode[]; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {nodes.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => onSelect(n.id)}
          className="flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-left text-xs text-slate-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/10"
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: NODE_STYLE[n.type].color }} aria-hidden />
          <span className="truncate">{n.name}</span>
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

export default function KnowledgePanel({ node, graph, result, busy, onSelectNode, onExpand, onAsk }: Props) {
  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
        <MousePointerClick className="h-7 w-7 text-cyan-300/80" aria-hidden />
        <p className="mt-3 text-sm font-medium text-slate-100">Select a node to inspect it</p>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-400">
          Click a sphere to focus it, double-click to expand its neighbourhood. Drag to orbit, scroll to zoom,
          right-drag to pan. Or say “Show me the cooling system”.
        </p>
      </div>
    );
  }

  const style = NODE_STYLE[node.type];
  const resolve = (ids: string[]) =>
    ids.map((id) => getNodeById(graph.nodes, id)).filter((n): n is KnowledgeNode => !!n);
  const unique = (ids: string[]) => [...new Set(ids)];

  const connected = resolve(
    unique([
      ...getRelatedIds(graph.links, node.id, "CONNECTED_TO", "both"),
      ...getRelatedIds(graph.links, node.id, "HAS_COMPONENT", "both"),
      ...getRelatedIds(graph.links, node.id, "HAS_SYSTEM", "both"),
    ]),
  );
  const symptoms = resolve(
    unique(
      node.type === "symptom"
        ? getRelatedIds(graph.links, node.id, "MAY_CAUSE", "both")
        : getRelatedIds(graph.links, node.id, "MAY_CAUSE", "out"),
    ),
  );
  const procedures = resolve(unique(getRelatedIds(graph.links, node.id, "INSPECT_USING", "both")));
  const documents = resolve(unique(getRelatedIds(graph.links, node.id, "DOCUMENTED_IN", "both")));
  const seededDocs = documents.filter((d) => d.metadata?.dynamic !== true);
  const liveDocs = documents.filter((d) => d.metadata?.dynamic === true);

  const dynamic = node.metadata?.dynamic === true;
  const url = typeof node.metadata?.url === "string" ? node.metadata.url : null;
  const provider = typeof node.metadata?.provider === "string" ? node.metadata.provider : null;
  const via = node.metadata?.via === "tavily-direct" ? "direct Tavily call" : "Telem";
  const inspection = typeof node.metadata?.inspection === "string" ? node.metadata.inspection : null;

  const resultIsAboutNode =
    !!result && (result.focusNodeId === node.id || result.highlightNodeIds.includes(node.id));
  const references = resultIsAboutNode ? result.sources.slice(0, 4) : [];

  return (
    <div className="animate-rise px-4 pb-5 pt-4" key={node.id}>
      <div className="flex items-start gap-3">
        <span
          className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ background: style.color, boxShadow: `0 0 14px ${style.color}` }}
          aria-hidden
        />
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold leading-snug text-white">{node.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full border px-2 py-0.5 font-medium" style={{ borderColor: `${style.color}66`, color: style.color }}>
              {style.label}
            </span>
            {dynamic ? (
              <span className="rounded-full border border-pink-300/40 px-2 py-0.5 text-pink-200">
                Live source · {provider ?? "web"} via {via}
              </span>
            ) : (
              <span className="rounded-full border border-amber-300/30 px-2 py-0.5 text-amber-200/90">Synthetic demo data</span>
            )}
          </div>
        </div>
      </div>

      <Section title={dynamic ? "Quoted from the source" : "Technical description"}>
        <p className="text-sm leading-relaxed text-slate-200">{dynamic ? `“${node.description}”` : node.description}</p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm text-cyan-300 underline-offset-2 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{hostOf(url)}</span>
          </a>
        )}
      </Section>

      {connected.length > 0 && (
        <Section title="Connected components">
          <NodeChips nodes={connected} onSelect={onSelectNode} />
        </Section>
      )}

      {symptoms.length > 0 && (
        <Section title={node.type === "symptom" ? "Possible causes and effects" : "Related symptoms"}>
          <NodeChips nodes={symptoms} onSelect={onSelectNode} />
        </Section>
      )}

      {(inspection || procedures.length > 0) && (
        <Section title="Inspection">
          {inspection && <p className="mb-2 text-sm leading-relaxed text-slate-200">{inspection}</p>}
          {procedures.length > 0 && <NodeChips nodes={procedures} onSelect={onSelectNode} />}
          <p className="mt-1.5 text-[11px] text-slate-500">Illustrative demo guidance, not a certified procedure.</p>
        </Section>
      )}

      {seededDocs.length > 0 && (
        <Section title="Demo documents">
          <NodeChips nodes={seededDocs} onSelect={onSelectNode} />
        </Section>
      )}

      {(liveDocs.length > 0 || references.length > 0) && (
        <Section title="Retrieved source references">
          <ul className="space-y-1.5">
            {liveDocs.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onSelectNode(d.id)}
                  className="w-full rounded-lg border border-violet-300/20 bg-violet-400/5 px-2.5 py-1.5 text-left text-xs text-slate-100 transition hover:border-violet-300/50"
                >
                  <span className="line-clamp-2">{d.name}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {typeof d.metadata?.host === "string" ? d.metadata.host : "source"} · in graph
                  </span>
                </button>
              </li>
            ))}
            {references
              .filter((s) => !liveDocs.some((d) => d.metadata?.url === s.url))
              .map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-100 transition hover:border-cyan-300/50"
                  >
                    <span className="line-clamp-2">{s.title}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {hostOf(s.url)} · {s.via === "telem" ? `Telem → ${s.provider}` : "Tavily direct"}
                    </span>
                  </a>
                </li>
              ))}
          </ul>
        </Section>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onExpand(node.id)}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-50"
        >
          <Expand className="h-4 w-4" aria-hidden /> Expand knowledge
        </button>
        <button
          type="button"
          onClick={() => onAsk(node)}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
        >
          <MessageCircleQuestion className="h-4 w-4" aria-hidden /> Ask AI
        </button>
      </div>
    </div>
  );
}
