"use client";

import { AlertTriangle, CheckCircle2, CircleSlash, ExternalLink, Loader2, Radar, Telescope, Volume2 } from "lucide-react";
import { hostOf } from "@/lib/graph-utils";
import type { HealthResponse, RetrievalCall, SearchResponse, SourceResult } from "@/lib/types";

type Props = {
  result: SearchResponse | null;
  research: SearchResponse | null;
  loading: boolean;
  researchLoading: boolean;
  health: HealthResponse | null;
  error: string | null;
  canSpeak: boolean;
  onDeepResearch: () => void;
  onSpeak: (text: string) => void;
};

const SERVICE_LABEL: Record<RetrievalCall["service"], string> = {
  "telem-search": "Telem · POST /v1/search",
  "telem-fetch": "Telem · POST /v1/fetch",
  "tavily-direct": "Tavily · direct SDK search",
};

const STATUS_STYLE: Record<RetrievalCall["status"], string> = {
  ok: "border-emerald-300/40 text-emerald-200",
  empty: "border-amber-300/40 text-amber-200",
  error: "border-rose-300/50 text-rose-200",
  timeout: "border-rose-300/50 text-rose-200",
};

const EVIDENCE_BADGE: Record<SearchResponse["evidenceStatus"], { text: string; tone: string }> = {
  sufficient: { text: "Source-backed", tone: "border-emerald-300/40 text-emerald-200" },
  incomplete: { text: "Evidence incomplete", tone: "border-amber-300/40 text-amber-200" },
  none: { text: "No sources retrieved", tone: "border-rose-300/50 text-rose-200" },
  not_configured: { text: "Demo mode · no live search", tone: "border-amber-300/40 text-amber-200" },
  not_needed: { text: "Answered from graph", tone: "border-sky-300/40 text-sky-200" },
};

const ms = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-2 py-1 text-xs">
      <dt className="text-slate-400">{label}</dt>
      <dd className="min-w-0 break-words text-slate-100">{children}</dd>
    </div>
  );
}

function provenance(s: SourceResult): string {
  const also = s.alsoFoundBy?.length ? ` (+ ${s.alsoFoundBy.join(", ")})` : "";
  return s.via === "telem" ? `Telem → ${s.provider}${also}` : "Tavily · direct call";
}

function CallCard({ call }: { call: RetrievalCall }) {
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-xs font-medium text-slate-100">{SERVICE_LABEL[call.service]}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_STYLE[call.status]}`}>
          {call.status}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        {ms(call.latencyMs)} measured by repAIr · {call.resultCount} result{call.resultCount === 1 ? "" : "s"}
      </p>
      {call.strategy && <p className="mt-0.5 text-[11px] text-slate-400">Request: {call.strategy}</p>}
      {call.routedProviders && call.routedProviders.length > 0 && (
        <p className="mt-0.5 text-[11px] text-cyan-200">Telem routing chose: {call.routedProviders.join(", ")}</p>
      )}
      {call.error && <p className="mt-1 text-[11px] text-rose-200">{call.error}</p>}
      {call.providers && call.providers.length > 0 && (
        <table className="mt-2 w-full text-left text-[11px]">
          <thead className="text-slate-500">
            <tr>
              <th className="py-0.5 font-normal">Provider</th>
              <th className="py-0.5 font-normal">Status</th>
              <th className="py-0.5 text-right font-normal">Results</th>
              <th className="py-0.5 text-right font-normal">Latency</th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {call.providers.map((p, i) => (
              <tr key={`${p.name}-${i}`} className="border-t border-white/5">
                <td className="py-0.5 font-medium text-cyan-100">{p.name}</td>
                <td className="py-0.5" title={p.error}>
                  {p.status}
                  {p.error ? " ⚠" : ""}
                </td>
                <td className="py-0.5 text-right tabular-nums">{p.resultCount}</td>
                <td className="py-0.5 text-right tabular-nums">{p.latencyMs !== undefined ? ms(p.latencyMs) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {call.interactionId && <p className="mt-1.5 truncate font-mono text-[10px] text-slate-500">interaction {call.interactionId}</p>}
    </li>
  );
}

function ResultView({
  r,
  heading,
  canSpeak,
  onSpeak,
}: {
  r: SearchResponse;
  heading: string;
  canSpeak: boolean;
  onSpeak: (text: string) => void;
}) {
  const badge = EVIDENCE_BADGE[r.evidenceStatus];
  const meta = r.searchMetadata;
  const sourceById = new Map(r.sources.map((s) => [s.id, s]));
  const providers = [...new Set(r.sources.map((s) => (s.via === "telem" ? s.provider : "tavily (direct)")))];
  const citationIndex = new Map(r.evidence.map((e, i) => [e.sourceId, i + 1]));

  return (
    <div className="animate-rise">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{heading}</h3>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${badge.tone}`}>{badge.text}</span>
      </div>

      <div className="mt-2 rounded-xl border border-cyan-300/20 bg-cyan-400/[0.06] p-3">
        <p className="text-sm leading-relaxed text-slate-100">{r.answer}</p>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            {r.answerMode === "llm"
              ? "Summary written by an LLM from the quotes below"
              : r.answerMode === "extractive"
                ? "Extractive: no generated claims"
                : "No web evidence used"}
          </span>
          {canSpeak && (
            <button
              type="button"
              onClick={() => onSpeak(r.spokenAnswer)}
              className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-slate-200 transition hover:border-cyan-300/50"
            >
              <Volume2 className="h-3 w-3" aria-hidden /> Read aloud
            </button>
          )}
        </div>
      </div>

      {r.evidence.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Evidence selected</h4>
          <ol className="space-y-2">
            {r.evidence.map((e, i) => {
              const s = sourceById.get(e.sourceId);
              if (!s) return null;
              return (
                <li key={e.sourceId} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <blockquote className="border-l-2 border-cyan-300/60 pl-2.5 text-[13px] leading-relaxed text-slate-100">
                    “{e.quote}”
                  </blockquote>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 flex items-center gap-1.5 text-xs text-cyan-300 underline-offset-2 hover:underline"
                  >
                    <span className="shrink-0 rounded bg-cyan-400/15 px-1 font-mono text-[10px] text-cyan-100">[{i + 1}]</span>
                    <span className="truncate">{s.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  </a>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {hostOf(s.url)} · {provenance(s)}
                    {s.fullTextFetched ? " · page text via Telem fetch" : ""}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {r.graphContext && (
        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/[0.05] p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/90">
            Demo graph context · synthetic, not verified by search
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-200">{r.graphContext}</p>
        </div>
      )}

      <dl className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1">
        <Row label="Original query">{r.query}</Row>
        <Row label="Expanded query">{r.expandedQuery}</Row>
        <Row label="Intent">{r.intent}</Row>
        <Row label="Primary">{meta.primaryProvider === "none" ? "none (no external call)" : meta.primaryProvider}</Row>
        <Row label="Providers">{providers.length ? providers.join(", ") : "—"}</Row>
        <Row label="Sources">
          {r.sources.length} retrieved · {r.evidence.length} selected as evidence
        </Row>
        <Row label="Search time">{ms(meta.latencyMs)} total, measured by repAIr</Row>
        <Row label="API fallback">
          {meta.fallbackUsed ? (
            <span className="text-amber-200">Used direct Tavily. {meta.fallbackReason}.</span>
          ) : meta.fallbackReason ? (
            <span className="text-amber-200">Not used. {meta.fallbackReason}.</span>
          ) : (
            "Not used"
          )}
        </Row>
      </dl>
      {meta.note && <p className="mt-1.5 text-[11px] text-slate-400">{meta.note}</p>}

      {meta.calls.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Retrieval log</h4>
          <ul className="space-y-2">
            {meta.calls.map((c, i) => (
              <CallCard key={`${c.service}-${i}`} call={c} />
            ))}
          </ul>
        </div>
      )}

      {r.sources.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Sources · ranked by repAIr term relevance
          </h4>
          <ul className="space-y-1.5">
            {r.sources.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 transition hover:border-cyan-300/50"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-xs text-slate-100">
                      {citationIndex.has(s.id) && <span className="mr-1 font-mono text-[10px] text-cyan-200">[{citationIndex.get(s.id)}]</span>}
                      {s.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400" title="Relevance computed by repAIr">
                      {(s.score ?? 0).toFixed(2)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {hostOf(s.url)} · {provenance(s)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function SearchIntelligencePanel(p: Props) {
  const { result, research, health } = p;
  const tavilyReady = !!health?.tavilyConfigured;
  const hasQuery = !!result;

  return (
    <div className="px-4 pb-5 pt-4">
      <div className="mb-3 grid grid-cols-2 gap-1.5 text-[11px]">
        {(
          [
            ["Telem", health?.telemConfigured],
            ["Tavily", health?.tavilyConfigured],
          ] as const
        ).map(([name, ok]) => (
          <span
            key={name}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${ok ? "border-emerald-300/30 text-emerald-200" : "border-white/10 text-slate-400"}`}
          >
            {ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <CircleSlash className="h-3.5 w-3.5" aria-hidden />}
            {name}: {health ? (ok ? "key configured" : "key not set") : "checking…"}
          </span>
        ))}
      </div>

      {p.error && (
        <p className="mb-3 flex items-start gap-2 rounded-xl border border-rose-300/40 bg-rose-500/10 p-2.5 text-xs text-rose-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {p.error}
        </p>
      )}

      {p.loading && (
        <p className="mb-3 flex items-center gap-2 text-xs text-cyan-200">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Retrieving sources…
        </p>
      )}

      {!result && !p.loading && (
        <div className="flex flex-col items-center px-2 py-8 text-center">
          <Radar className="h-7 w-7 text-cyan-300/80" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-100">No search yet</p>
          <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-400">
            Ask a technical question to see how it was routed: the expanded query, which providers Telem called,
            timings, sources and the evidence selected.
          </p>
        </div>
      )}

      {result && <ResultView r={result} heading="Search intelligence" canSpeak={p.canSpeak} onSpeak={p.onSpeak} />}

      <div className="mt-4 rounded-xl border border-violet-300/25 bg-violet-400/[0.06] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-violet-100">Deep Research</p>
            <p className="text-[11px] text-slate-400">A separate, direct Tavily search for the current question.</p>
          </div>
          <button
            type="button"
            onClick={p.onDeepResearch}
            disabled={!tavilyReady || !hasQuery || p.researchLoading}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:bg-violet-400/25 disabled:text-slate-400"
          >
            {p.researchLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Telescope className="h-4 w-4" aria-hidden />}
            Run
          </button>
        </div>
        {!tavilyReady && health && (
          <p className="mt-2 text-[11px] text-amber-200">TAVILY_API_KEY is not set, so Deep Research is unavailable.</p>
        )}
        {tavilyReady && !hasQuery && <p className="mt-2 text-[11px] text-slate-400">Ask a question first.</p>}
      </div>

      {research && (
        <div className="mt-4">
          <ResultView r={research} heading="Deep research · Tavily direct" canSpeak={p.canSpeak} onSpeak={p.onSpeak} />
        </div>
      )}
    </div>
  );
}
