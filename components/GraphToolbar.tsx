"use client";

import {
  Expand,
  Filter,
  Gauge,
  Home,
  Network,
  RefreshCcw,
  Rotate3d,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";

type Props = {
  hasSelection: boolean;
  rotating: boolean;
  filtered: boolean;
  lowPower: boolean;
  onHome: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleRotate: () => void;
  onResetGraph: () => void;
  onExpandSelected: () => void;
  onShowAll: () => void;
  onFilterSystem: () => void;
  onToggleLowPower: () => void;
};

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition
        ${active ? "border-cyan-300/70 bg-cyan-400/20 text-cyan-100" : "border-transparent text-slate-300 hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-100"}
        disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-transparent disabled:hover:bg-transparent`}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden />
      <span className="pointer-events-none absolute left-full z-20 ml-2 hidden whitespace-nowrap rounded-md border border-cyan-400/20 bg-slate-950/95 px-2 py-1 text-xs text-slate-100 group-hover:block max-md:group-hover:hidden">
        {label}
      </span>
    </button>
  );
}

export default function GraphToolbar(p: Props) {
  return (
    <nav
      aria-label="Graph controls"
      className="glass flex gap-1 rounded-2xl p-1.5 max-md:max-w-full max-md:overflow-x-auto md:flex-col"
    >
      <ToolButton icon={Home} label="Home: fit the whole graph" onClick={p.onHome} />
      <ToolButton icon={ZoomIn} label="Zoom in" onClick={p.onZoomIn} />
      <ToolButton icon={ZoomOut} label="Zoom out" onClick={p.onZoomOut} />
      <ToolButton icon={Rotate3d} label={p.rotating ? "Stop rotating" : "Rotate"} onClick={p.onToggleRotate} active={p.rotating} />
      <span className="mx-1 w-px self-stretch bg-white/10 md:mx-0 md:my-1 md:h-px md:w-auto" aria-hidden />
      <ToolButton icon={Expand} label="Expand selected node" onClick={p.onExpandSelected} disabled={!p.hasSelection} />
      <ToolButton
        icon={Filter}
        label={p.filtered ? "Clear filter" : "Filter to selected system"}
        onClick={p.onFilterSystem}
        disabled={!p.hasSelection && !p.filtered}
        active={p.filtered}
      />
      <ToolButton icon={Network} label="Show all nodes" onClick={p.onShowAll} />
      <ToolButton icon={RefreshCcw} label="Reset graph" onClick={p.onResetGraph} />
      <span className="mx-1 w-px self-stretch bg-white/10 md:mx-0 md:my-1 md:h-px md:w-auto" aria-hidden />
      <ToolButton
        icon={Gauge}
        label={p.lowPower ? "Reduced effects on" : "Reduce visual effects"}
        onClick={p.onToggleLowPower}
        active={p.lowPower}
      />
    </nav>
  );
}
