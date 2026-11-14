"use client";

import { Hand, Loader2 } from "lucide-react";
import type { HandGestures } from "@/hooks/useHandGestures";
import { POSE_LABEL } from "@/lib/hand-gestures";

const LEGEND = [
  ["✊", "Fist + move", "rotate"],
  ["🤏", "Pinch + up/down", "zoom"],
  ["✋", "Open palm + move", "pan"],
  ["☝️", "Point and hold", "select"],
  ["👍", "Thumbs up", "expand"],
  ["👎", "Thumbs down", "back"],
  ["✌️", "Victory", "related"],
  ["☝️✖️☝️", "Cross index fingers (X)", "exit"],
] as const;

/** Header button: turns the camera on (standby) and off. */
export function GestureToggle({ gestures }: { gestures: HandGestures }) {
  const on = gestures.active || gestures.starting;
  const label = !gestures.supported
    ? "Hand gestures need a camera and HTTPS"
    : on
      ? "Turn hand gestures off"
      : "Turn on the camera for hand gestures";

  return (
    <button
      type="button"
      onClick={on ? gestures.stop : gestures.start}
      disabled={!gestures.supported}
      title={label}
      aria-label={label}
      aria-pressed={on}
      className={`glass flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition
        ${on ? "border-cyan-300/60 text-cyan-100" : "text-slate-200 hover:border-cyan-400/40 hover:text-cyan-100"}
        disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <Hand className="h-3.5 w-3.5" aria-hidden />
      Gestures
      {on && (
        <span
          className={`h-2 w-2 rounded-full ${gestures.mode === "active" ? "bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.9)]" : "bg-amber-300"}`}
          aria-hidden
        />
      )}
    </button>
  );
}

/** Self-view, mode and the gesture being held. Rendered all the time so the <video> exists before start(). */
export function GesturePanel({ gestures }: { gestures: HandGestures }) {
  const on = gestures.active || gestures.starting;
  const activeMode = gestures.mode === "active";
  const label = !gestures.active
    ? "Starting camera…"
    : !activeMode
      ? gestures.handVisible && gestures.pose === "ok"
        ? "Hold the OK sign…"
        : "👌 Show an OK sign to start"
      : gestures.handVisible
        ? POSE_LABEL[gestures.pose]
        : POSE_LABEL.none;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className={`glass w-28 overflow-hidden rounded-2xl sm:w-48 ${on ? "" : "hidden"}`}>
        <div className="flex items-center justify-between gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
          <span className={activeMode ? "text-cyan-200" : "text-amber-200"}>{activeMode ? "Active" : "Standby"}</span>
          {gestures.delegate && <span className="text-emerald-200/80">{gestures.delegate}</span>}
        </div>
        <div className="relative aspect-[4/3] bg-black">
          {/* Mirrored self-view: moving your hand right moves it right on screen. */}
          <video ref={gestures.videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          {gestures.starting && (
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-slate-950/70 text-[11px] text-cyan-100">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading…
            </div>
          )}
        </div>
        <div className="h-1 bg-white/10" aria-hidden>
          <div ref={gestures.progressRef} className={`h-full w-0 ${activeMode ? "bg-cyan-300" : "bg-amber-300"}`} />
        </div>
        <p aria-live="polite" className="px-2 py-1 text-[11px] leading-tight text-slate-100">
          {label}
        </p>
        {activeMode && (
          <ul className="border-t border-white/10 px-2 py-1 text-[10px] leading-snug text-slate-300 max-sm:hidden [@media(max-height:760px)]:hidden">
            {LEGEND.map(([icon, gesture, action]) => (
              <li key={gesture} className="flex justify-between gap-2">
                <span>
                  <span aria-hidden>{icon}</span> {gesture}
                </span>
                <span className="shrink-0 text-slate-100">{action}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {gestures.error && (
        <p className="glass max-w-52 rounded-xl px-2 py-1 text-[11px] text-amber-200" role="alert">
          {gestures.error}
        </p>
      )}
    </div>
  );
}
