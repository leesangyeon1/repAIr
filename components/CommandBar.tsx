"use client";

import { Loader2, Search, Sparkles, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { VoiceCommands } from "@/hooks/useVoiceCommands";
import { MAX_QUERY_LENGTH } from "@/lib/types";
import VoiceControls from "./VoiceControls";

type Props = {
  voice: VoiceCommands;
  voiceOutput: boolean;
  onToggleVoiceOutput: () => void;
  loading: boolean;
  /** Short feedback line: what the last command did. */
  status: string | null;
  onSubmit: (text: string) => void;
  onClear: () => void;
};

const SUGGESTIONS = [
  "Show me the cooling system",
  "Why is the engine overheating?",
  "Expand the cooling pump",
  "Hide unrelated nodes",
];

export default function CommandBar({ voice, voiceOutput, onToggleVoiceOutput, loading, status, onSubmit, onClear }: Props) {
  const [text, setText] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSubmit(value);
    setText("");
  };

  const heard = voice.listening ? voice.interim : voice.transcript;
  const line = voice.error
    ? { tone: "text-amber-200", text: voice.error }
    : voice.listening
      ? { tone: "text-pink-200", text: heard ? `Listening… “${heard}”` : "Listening… speak a command" }
      : status
        ? { tone: "text-slate-300", text: status }
        : null;

  return (
    <div className="w-full">
      <div className="mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 max-sm:hidden">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSubmit(s)}
            disabled={loading}
            className="shrink-0 rounded-full border border-cyan-400/20 bg-slate-950/60 px-3 py-1 text-xs text-cyan-100/90 backdrop-blur transition hover:border-cyan-300/50 hover:bg-cyan-400/10 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="glass-strong flex items-center gap-2 rounded-full p-1.5 pl-4">
        {loading ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-300" aria-label="Searching" />
        ) : (
          <Sparkles className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Ask repAIr anything about this machine..."
          aria-label="Ask repAIr anything about this machine"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-slate-50 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            setText("");
            onClear();
          }}
          title="Clear search and highlights"
          aria-label="Clear search and highlights"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
        >
          <X className="h-[18px] w-[18px]" aria-hidden />
        </button>
        <VoiceControls voice={voice} voiceOutput={voiceOutput} onToggleVoiceOutput={onToggleVoiceOutput} />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-400/30 disabled:text-slate-300"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="max-sm:hidden">Search</span>
        </button>
      </form>

      <p aria-live="polite" className={`mt-1.5 min-h-5 truncate px-4 text-xs ${line?.tone ?? ""}`}>
        {line?.text ?? ""}
      </p>
    </div>
  );
}
