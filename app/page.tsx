"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CommandBar from "@/components/CommandBar";
import GraphErrorBoundary from "@/components/GraphErrorBoundary";
import GraphToolbar from "@/components/GraphToolbar";
import type { GraphHandle } from "@/components/HolographicGraph";
import KnowledgePanel from "@/components/KnowledgePanel";
import SearchIntelligencePanel from "@/components/SearchIntelligencePanel";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { parseCommand, type Command } from "@/lib/command-parser";
import { DATASETS, getDataset } from "@/lib/datasets";
import { NODE_STYLE, initialGraph } from "@/lib/graph-data";
import { findOwningSystem, getNeighborIds, getNodeById, getSystemSubgraphIds, mergeGraph } from "@/lib/graph-utils";
import {
  NODE_TYPES,
  healthResponseSchema,
  searchResponseSchema,
  type DatasetId,
  type HealthResponse,
  type KnowledgeGraph,
  type KnowledgeNode,
  type SearchResponse,
} from "@/lib/types";

// WebGL never runs on the server: the graph module is only loaded in the browser.
const HolographicGraph = dynamic(() => import("@/components/HolographicGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-cyan-200/80">
      Initialising hologram…
    </div>
  ),
});

type Tab = "node" | "intel";

async function postJson(path: string, body: unknown): Promise<SearchResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      json && typeof json === "object" && "error" in json && typeof json.error === "string"
        ? json.error
        : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  const parsed = searchResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("The server returned an unexpected response.");
  return parsed.data;
}

export default function Home() {
  const graphApi = useRef<GraphHandle | null>(null);
  const requestSeq = useRef(0);
  const voiceOutputTouched = useRef(false);
  const selectedRef = useRef<string | null>(null);

  const [datasetId, setDatasetId] = useState<DatasetId>("aerospace");
  const dataset = getDataset(datasetId);
  const seed = dataset.graph;
  const [graph, setGraph] = useState<KnowledgeGraph>(() => initialGraph());
  const [dynamicGraph, setDynamicGraph] = useState<KnowledgeGraph>({ nodes: [], links: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [filterIds, setFilterIds] = useState<string[] | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [rotating, setRotating] = useState(false);
  const [lowPower, setLowPower] = useState(false);
  const [tab, setTab] = useState<Tab>("node");
  const [panelOpen, setPanelOpen] = useState(false);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [research, setResearch] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [voiceOutput, setVoiceOutput] = useState(false);

  /** Seeded + retrieved knowledge, including nodes not yet revealed in the hologram. */
  const known = useMemo<KnowledgeGraph>(() => {
    const merged = mergeGraph(seed, dynamicGraph.nodes, dynamicGraph.links);
    return { nodes: merged.nodes, links: merged.links };
  }, [dynamicGraph, seed]);

  const selectedNode = getNodeById(known.nodes, selectedId) ?? null;
  const liveSearch = !!health && (health.telemConfigured || health.tavilyConfigured);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => r.json())
      .then((json: unknown) => {
        const parsed = healthResponseSchema.safeParse(json);
        if (!cancelled && parsed.success) setHealth(parsed.data);
      })
      .catch(() => {
        if (!cancelled) setHealth({ status: "ok", telemConfigured: false, tavilyConfigured: false, llmConfigured: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setLowPower(true);
  }, []);

  /* ---------- Graph mutations ---------- */

  /** Bring seeded nodes (by id) and any retrieved nodes into the hologram, without duplicates. */
  const reveal = useCallback((ids: string[], extra?: KnowledgeGraph) => {
    const wanted = new Set(ids);
    setGraph((current) => {
      const merged = mergeGraph(
        current,
        [...seed.nodes.filter((n) => wanted.has(n.id)), ...(extra?.nodes ?? [])],
        [...seed.links, ...(extra?.links ?? [])],
      );
      return merged.addedNodeIds.length || merged.links.length !== current.links.length
        ? { nodes: merged.nodes, links: merged.links }
        : current;
    });
  }, [seed]);

  /** Change the selection, remembering the previous node for "go back". */
  const moveSelection = useCallback((id: string | null, record = true) => {
    const previous = selectedRef.current;
    if (record && previous && id && previous !== id) setHistory((h) => [...h.slice(-19), previous]);
    selectedRef.current = id;
    setSelectedId(id);
  }, []);

  const addDynamic = useCallback(
    (r: SearchResponse) => {
      if (!r.newNodes.length) return;
      setDynamicGraph((current) => {
        const merged = mergeGraph({ nodes: [...seed.nodes, ...current.nodes], links: current.links }, r.newNodes, r.newLinks);
        return {
          nodes: merged.nodes.filter((n) => n.metadata?.dynamic === true),
          links: merged.links,
        };
      });
      reveal([], { nodes: r.newNodes, links: r.newLinks });
    },
    [reveal, seed],
  );

  const selectNode = useCallback(
    (id: string | null, options: { keepHighlights?: boolean; record?: boolean } = {}) => {
      if (!options.keepHighlights) setHighlightIds([]);
      moveSelection(id, options.record !== false);
      if (!id) return;
      reveal([id]);
      setFilterIds((current) => (current && !current.includes(id) ? null : current));
      setTab("node");
      setPanelOpen(true);
      graphApi.current?.focusNode(id);
    },
    [moveSelection, reveal],
  );

  /* ---------- Retrieval ---------- */

  const applyResult = useCallback(
    (r: SearchResponse) => {
      reveal(r.highlightNodeIds);
      addDynamic(r);
      setHighlightIds([...r.highlightNodeIds, ...r.newNodes.map((n) => n.id)]);
      setFilterIds(null);
      if (r.focusNodeId) {
        moveSelection(r.focusNodeId);
        graphApi.current?.focusNode(r.focusNodeId);
      }
    },
    [addDynamic, moveSelection, reveal],
  );

  const runSearch = useCallback(
    async (query: string, nodeId?: string | null, mode: "normal" | "expand" = "normal"): Promise<SearchResponse | null> => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      setStatus(mode === "expand" ? "Retrieving live sources for this node…" : `Searching: “${query}”`);
      try {
        const r = await postJson("/api/search", { query, selectedNodeId: nodeId ?? null, mode, datasetId });
        if (seq !== requestSeq.current) return null;
        setResult(r);
        setResearch(null);
        applyResult(r);
        setTab("intel");
        setPanelOpen(true);
        return r;
      } catch (err) {
        if (seq !== requestSeq.current) return null;
        const message = err instanceof Error ? err.message : "Search failed.";
        setError(message);
        setStatus(message);
        setTab("intel");
        return null;
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [applyResult, datasetId],
  );

  const describe = useCallback((r: SearchResponse): string => {
    const focus = getNodeById(seed.nodes, r.focusNodeId)?.name;
    const where = focus ? ` Focused on ${focus}.` : "";
    if (r.searchMetadata.mode === "demo") return `Demo mode: answered from the synthetic graph.${where}`;
    if (r.evidenceStatus === "not_needed") return `Answered from the knowledge graph.${where}`;
    const failure = r.searchMetadata.calls.find((c) => c.status === "error" || c.status === "timeout");
    if (!r.sources.length && failure) return `Live search failed: ${failure.error ?? "request error"}.${where}`;
    return `${r.sources.length} source${r.sources.length === 1 ? "" : "s"} retrieved, ${r.evidence.length} used as evidence, in ${(r.searchMetadata.latencyMs / 1000).toFixed(1)} s.${where}`;
  }, [seed]);

  /* ---------- Voice ---------- */

  const commandHandler = useRef<(text: string, viaVoice: boolean) => void>(() => undefined);
  const voice = useVoiceCommands(
    useCallback((text: string) => {
      commandHandler.current(text, true);
    }, []),
  );
  const { speak, stopSpeaking } = voice;

  const expandNode = useCallback(
    async (id: string) => {
      const node = getNodeById(known.nodes, id);
      if (!node) return;
      if (node.metadata?.dynamic === true) {
        selectNode(id);
        setStatus("This is a retrieved source. Open its link in the panel to read it.");
        return;
      }
      const neighbors = [...getNeighborIds(known.links, id)];
      const before = new Set(graph.nodes.map((n) => n.id));
      const revealed = neighbors.filter((n) => !before.has(n)).length;
      reveal([id, ...neighbors], dynamicGraph);
      selectNode(id);
      setHighlightIds(neighbors);
      const local = revealed
        ? `Expanded ${node.name}: ${revealed} connected node${revealed === 1 ? "" : "s"} revealed.`
        : `${node.name} is already fully expanded.`;
      if (!liveSearch) {
        setStatus(`${local} Live source nodes need a search key.`);
        return;
      }
      setStatus(local);
      const r = await runSearch(`${node.name} troubleshooting and inspection`, id, "expand");
      if (r) {
        setHighlightIds([...neighbors, ...r.newNodes.map((n) => n.id)]);
        setStatus(
          r.newNodes.length
            ? `${local} Added ${r.newNodes.length} live source node${r.newNodes.length === 1 ? "" : "s"}.`
            : r.sources.length
              ? `${local} No retrieved source met the evidence threshold.`
              : `${local} Live search returned no sources (see Search Intelligence).`,
        );
      }
    },
    [dynamicGraph, graph.nodes, known, liveSearch, reveal, runSearch, selectNode],
  );

  const deepResearch = useCallback(async () => {
    if (!result) {
      setStatus("Ask a question first, then run Deep Research on it.");
      return;
    }
    setResearchLoading(true);
    setError(null);
    setTab("intel");
    setPanelOpen(true);
    setStatus("Deep Research: querying Tavily directly…");
    try {
      const r = await postJson("/api/research", {
        query: result.query,
        selectedNodeId: result.focusNodeId ?? selectedId,
        datasetId,
      });
      setResearch(r);
      addDynamic(r);
      if (r.newNodes.length) setHighlightIds((h) => [...new Set([...h, ...r.newNodes.map((n) => n.id)])]);
      setStatus(
        r.searchMetadata.mode === "demo"
          ? "Deep Research is unavailable: TAVILY_API_KEY is not set."
          : `Deep Research: ${r.sources.length} Tavily source${r.sources.length === 1 ? "" : "s"}, ${r.newNodes.length} added to the graph.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deep Research failed.";
      setError(message);
      setStatus(message);
    } finally {
      setResearchLoading(false);
    }
  }, [addDynamic, datasetId, result, selectedId]);

  /** Clear everything and show the starting view of `start` (the active dataset unless switching). */
  const resetTo = useCallback((start: KnowledgeGraph, message: string) => {
    requestSeq.current++;
    stopSpeaking();
    setGraph(initialGraph(start));
    setDynamicGraph({ nodes: [], links: [] });
    moveSelection(null);
    setHighlightIds([]);
    setFilterIds(null);
    setHistory([]);
    setResult(null);
    setResearch(null);
    setError(null);
    setLoading(false);
    setRotating(false);
    setStatus(message);
    window.setTimeout(() => graphApi.current?.resetView(), 400);
  }, [moveSelection, stopSpeaking]);

  const resetGraph = useCallback(() => resetTo(seed, "Graph reset to the starting view."), [resetTo, seed]);

  const switchDataset = useCallback(
    (id: DatasetId) => {
      const next = getDataset(id);
      setDatasetId(id);
      resetTo(next.graph, `Switched to the ${next.name} example.`);
    },
    [resetTo],
  );

  const showAll = useCallback(() => {
    setFilterIds(null);
    setHighlightIds([]);
    reveal(
      seed.nodes.map((n) => n.id),
      dynamicGraph,
    );
    setStatus("Showing every node in the knowledge base.");
    window.setTimeout(() => graphApi.current?.resetView(), 700);
  }, [dynamicGraph, reveal, seed]);

  const hideUnrelated = useCallback(() => {
    if (!selectedId) {
      setStatus("Select a node first, then hide unrelated nodes.");
      return;
    }
    setFilterIds([selectedId, ...getNeighborIds(graph.links, selectedId)]);
    setStatus("Showing only the selected node and its direct connections.");
  }, [graph.links, selectedId]);

  const toggleSystemFilter = useCallback(() => {
    if (filterIds) {
      setFilterIds(null);
      setStatus("Filter cleared.");
      return;
    }
    const system = selectedId ? findOwningSystem(known, selectedId) : undefined;
    if (!system) {
      setStatus("Select a system or one of its components to filter.");
      return;
    }
    const ids = [...getSystemSubgraphIds(known, system.id)];
    if (selectedId) ids.push(selectedId);
    setFilterIds(ids);
    setStatus(`Filtered to the ${system.name}.`);
    window.setTimeout(() => graphApi.current?.resetView(), 300);
  }, [filterIds, known, selectedId]);

  const execute = useCallback(
    async (commands: Command[], viaVoice: boolean) => {
      for (const command of commands) {
        switch (command.type) {
          case "zoom_in":
            graphApi.current?.zoom(0.6);
            setStatus("Zoomed in.");
            break;
          case "zoom_out":
            graphApi.current?.zoom(1.6);
            setStatus("Zoomed out.");
            break;
          case "rotate":
            setRotating(true);
            setStatus("Rotating. Say “stop rotating” or press Rotate again to stop.");
            break;
          case "stop_rotate":
            setRotating(false);
            setStatus("Rotation stopped.");
            break;
          case "reset_view":
            moveSelection(null);
            setHighlightIds([]);
            setFilterIds(null);
            graphApi.current?.resetView();
            setStatus("View reset.");
            break;
          case "go_back": {
            const previous = history[history.length - 1];
            if (!previous) {
              setStatus("There is no previous node to go back to.");
              break;
            }
            setHistory((h) => h.slice(0, -1));
            selectNode(previous, { record: false });
            setStatus(`Back to ${getNodeById(known.nodes, previous)?.name ?? "the previous node"}.`);
            break;
          }
          case "focus":
            selectNode(command.nodeId);
            setStatus(`Showing ${getNodeById(known.nodes, command.nodeId)?.name ?? "node"}.`);
            break;
          case "expand": {
            const id = command.nodeId ?? selectedId;
            if (!id) setStatus("Select a node first, or say “expand the cooling pump”.");
            else await expandNode(id);
            break;
          }
          case "show_related": {
            if (!selectedId) {
              setStatus("Select a node first to show what it relates to.");
              break;
            }
            const neighbors = [...getNeighborIds(known.links, selectedId)];
            reveal(neighbors, dynamicGraph);
            setFilterIds(null);
            setHighlightIds(neighbors);
            setStatus(`Highlighted ${neighbors.length} related node${neighbors.length === 1 ? "" : "s"}.`);
            break;
          }
          case "hide_unrelated":
            hideUnrelated();
            break;
          case "show_all":
            showAll();
            break;
          case "read_answer": {
            const text = (research ?? result)?.spokenAnswer;
            if (text) speak(text);
            else setStatus("There is no answer to read yet.");
            break;
          }
          case "stop_speaking":
            stopSpeaking();
            setStatus("Stopped speaking.");
            break;
          case "deep_research":
            await deepResearch();
            break;
          case "needs_selection":
            setStatus("Select a node first so I know what “this” refers to.");
            break;
          case "search": {
            const r = await runSearch(command.query, command.nodeId ?? selectedId);
            if (r) {
              setStatus(describe(r));
              // Spoken answers: when the toggle is on, or on first use of the microphone.
              if (voiceOutput || (viaVoice && !voiceOutputTouched.current)) speak(r.spokenAnswer);
            }
            break;
          }
        }
      }
    },
    [
      deepResearch,
      describe,
      dynamicGraph,
      expandNode,
      hideUnrelated,
      history,
      known,
      moveSelection,
      research,
      result,
      reveal,
      runSearch,
      selectNode,
      selectedId,
      showAll,
      speak,
      stopSpeaking,
      voiceOutput,
    ],
  );

  const handleText = useCallback(
    (text: string, viaVoice: boolean) => {
      // Using the microphone switches spoken answers on, unless the user already chose otherwise.
      if (viaVoice && !voiceOutputTouched.current) setVoiceOutput(true);
      const commands = parseCommand(text, { nodes: seed.nodes, selectedNodeId: selectedId });
      if (!commands.length) return;
      void execute(commands, viaVoice);
    },
    [execute, seed, selectedId],
  );

  useEffect(() => {
    commandHandler.current = handleText;
  }, [handleText]);

  const clearAll = useCallback(() => {
    requestSeq.current++;
    stopSpeaking();
    setLoading(false);
    setResult(null);
    setResearch(null);
    setError(null);
    setHighlightIds([]);
    setFilterIds(null);
    setStatus("Cleared search results and highlights.");
  }, [stopSpeaking]);

  const askAbout = useCallback(
    (node: KnowledgeNode) => {
      const query =
        node.type === "symptom"
          ? `What causes ${node.name.toLowerCase()}?`
          : node.type === "procedure" || node.type === "document"
            ? `Explain ${node.name}`
            : `Explain the ${node.name}: what it does and how it fails`;
      void execute([{ type: "search", query, nodeId: node.id }], false);
    },
    [execute],
  );

  // A configured key can still be rejected; reflect what the last real call reported.
  const telemRejected =
    !!result && !result.sources.some((s) => s.via === "telem") &&
    result.searchMetadata.calls.some((c) => c.service === "telem-search" && (c.status === "error" || c.status === "timeout"));

  const statusPill = !health
    ? { text: "Checking search APIs…", tone: "border-white/15 text-slate-300", dot: "bg-slate-400" }
    : telemRejected
      ? { text: "Telem call failed · see Search Intelligence", tone: "border-rose-300/50 text-rose-200", dot: "bg-rose-400" }
      : health.telemConfigured
      ? {
          text: `Live search · Telem${health.tavilyConfigured ? " + Tavily" : ""}`,
          tone: "border-emerald-300/40 text-emerald-200",
          dot: "bg-emerald-400",
        }
      : health.tavilyConfigured
        ? { text: "Live search · Tavily only", tone: "border-amber-300/40 text-amber-200", dot: "bg-amber-400" }
        : { text: "Interactive demo · search keys not set", tone: "border-amber-300/40 text-amber-200", dot: "bg-amber-400" };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-void text-slate-100">
      {/* Hologram: ~73% of the width on desktop */}
      <div className="absolute inset-0 lg:right-[27%]">
        <GraphErrorBoundary>
          <HolographicGraph
            handleRef={graphApi}
            nodes={graph.nodes}
            links={graph.links}
            selectedId={selectedId}
            highlightIds={highlightIds}
            visibleIds={filterIds}
            autoRotate={rotating}
            lowPower={lowPower}
            onSelect={(id) => selectNode(id)}
            onExpand={(id) => void expandNode(id)}
          />
        </GraphErrorBoundary>
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(2,4,12,0.85)_100%)]"
          aria-hidden
        />
      </div>

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4 lg:right-[27%]">
        <div className="pointer-events-auto min-w-0">
          <h1 className="text-2xl font-bold leading-none tracking-tight text-white sm:text-[28px]">
            rep<span className="text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]">AI</span>r
          </h1>
          <p className="mt-1 text-xs text-slate-300 sm:text-sm">Your Technical Knowledge, Reimagined in 3D</p>
        </div>
        <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-1.5">
          <span className={`glass flex items-center gap-2 rounded-full px-3 py-1 text-xs ${statusPill.tone}`}>
            <span className={`h-2 w-2 rounded-full ${statusPill.dot}`} aria-hidden />
            {statusPill.text}
          </span>
          <label className="glass flex items-center gap-1.5 rounded-full py-1 pl-3 pr-2 text-xs text-cyan-100">
            <span className="text-slate-400">Example</span>
            <select
              value={datasetId}
              onChange={(e) => switchDataset(e.target.value as DatasetId)}
              aria-label="Example machine"
              className="cursor-pointer bg-transparent font-medium text-cyan-100 focus:outline-none"
            >
              {DATASETS.map((d) => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-slate-100">
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <span className="glass rounded-full px-3 py-1 text-[11px] text-amber-200/90 max-sm:hidden">{dataset.label}</span>
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            className="glass flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-cyan-100 lg:hidden"
            aria-expanded={panelOpen}
          >
            {panelOpen ? <PanelRightClose className="h-3.5 w-3.5" aria-hidden /> : <PanelRightOpen className="h-3.5 w-3.5" aria-hidden />}
            Details
          </button>
        </div>
      </header>

      <div className="absolute left-2 top-[92px] z-10 max-w-[calc(100%-1rem)] md:left-3 md:top-1/2 md:-translate-y-1/2">
        <GraphToolbar
          hasSelection={!!selectedId}
          rotating={rotating}
          filtered={!!filterIds}
          lowPower={lowPower}
          onHome={() => void execute([{ type: "reset_view" }], false)}
          onZoomIn={() => graphApi.current?.zoom(0.6)}
          onZoomOut={() => graphApi.current?.zoom(1.6)}
          onToggleRotate={() => setRotating((r) => !r)}
          onResetGraph={resetGraph}
          onExpandSelected={() => selectedId && void expandNode(selectedId)}
          onShowAll={showAll}
          onFilterSystem={toggleSystemFilter}
          onToggleLowPower={() => setLowPower((v) => !v)}
        />
      </div>

      <ul className="pointer-events-none absolute left-4 top-[72px] z-10 hidden flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-300 md:flex">
        {NODE_TYPES.map((type) => (
          <li key={type} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: NODE_STYLE[type].color }} aria-hidden />
            {NODE_STYLE[type].label}
          </li>
        ))}
      </ul>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-2 lg:right-[27%]">
        <div className="pointer-events-auto w-full max-w-2xl">
          <CommandBar
            voice={voice}
            voiceOutput={voiceOutput}
            onToggleVoiceOutput={() => {
              voiceOutputTouched.current = true;
              setVoiceOutput((on) => {
                if (on) stopSpeaking();
                return !on;
              });
            }}
            loading={loading || researchLoading}
            status={status}
            suggestions={dataset.suggestions}
            onSubmit={(text) => handleText(text, false)}
            onClear={clearAll}
          />
        </div>
      </div>

      <aside
        aria-label="Knowledge and search details"
        className={`z-30 p-2 lg:absolute lg:inset-y-0 lg:right-0 lg:block lg:w-[27%] lg:p-3 lg:pl-0
          max-lg:absolute max-lg:inset-x-0 max-lg:bottom-[104px] max-lg:top-[46%] ${panelOpen ? "" : "max-lg:hidden"}`}
      >
        <div className="glass flex h-full flex-col overflow-hidden rounded-2xl">
          <div role="tablist" className="flex shrink-0 border-b border-white/10 p-1.5">
            {(
              [
                ["node", "Component"],
                ["intel", "Search Intelligence"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                  tab === id ? "bg-cyan-400/15 text-cyan-100" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {label}
                {id === "intel" && (loading || researchLoading) ? " …" : ""}
              </button>
            ))}
          </div>
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
            {tab === "node" ? (
              <KnowledgePanel
                node={selectedNode}
                graph={known}
                result={result}
                busy={loading}
                onSelectNode={(id) => selectNode(id)}
                onExpand={(id) => void expandNode(id)}
                onAsk={askAbout}
              />
            ) : (
              <SearchIntelligencePanel
                result={result}
                research={research}
                loading={loading}
                researchLoading={researchLoading}
                health={health}
                error={error}
                canSpeak={voice.ttsSupported}
                onDeepResearch={() => void deepResearch()}
                onSpeak={speak}
              />
            )}
          </div>
        </div>
      </aside>
    </main>
  );
}
