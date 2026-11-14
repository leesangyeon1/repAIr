"use client";

import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import type { VoiceCommands } from "@/hooks/useVoiceCommands";

type Props = {
  voice: VoiceCommands;
  voiceOutput: boolean;
  onToggleVoiceOutput: () => void;
};

export default function VoiceControls({ voice, voiceOutput, onToggleVoiceOutput }: Props) {
  const micLabel = !voice.supported
    ? "Voice input is not supported in this browser"
    : voice.listening
      ? "Stop listening"
      : "Speak a command";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={voice.listening ? voice.stop : voice.start}
        disabled={!voice.supported}
        title={micLabel}
        aria-label={micLabel}
        aria-pressed={voice.listening}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition
          ${voice.listening ? "border-pink-300/80 bg-pink-500/25 text-pink-100" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20"}
          disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500`}
      >
        {voice.listening && (
          <span className="absolute inset-0 animate-pulseRing rounded-full border border-pink-300/70 motion-reduce:hidden" aria-hidden />
        )}
        {voice.supported ? <Mic className="h-[18px] w-[18px]" aria-hidden /> : <MicOff className="h-[18px] w-[18px]" aria-hidden />}
      </button>
      <button
        type="button"
        onClick={onToggleVoiceOutput}
        disabled={!voice.ttsSupported}
        title={voiceOutput ? "Spoken answers on" : "Spoken answers off"}
        aria-label={voiceOutput ? "Turn spoken answers off" : "Turn spoken answers on"}
        aria-pressed={voiceOutput}
        className={`flex h-10 w-10 items-center justify-center rounded-full border transition
          ${voiceOutput ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-100" : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"}
          disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {voiceOutput ? <Volume2 className="h-[18px] w-[18px]" aria-hidden /> : <VolumeX className="h-[18px] w-[18px]" aria-hidden />}
      </button>
    </div>
  );
}
