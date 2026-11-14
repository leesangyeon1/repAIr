"use client";

import { Component, type ReactNode } from "react";

/** Keeps the rest of the interface usable if the WebGL scene throws while rendering. */
export default class GraphErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[repAIr] 3D view failed:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-center">
        <div className="glass max-w-md rounded-2xl p-6">
          <p className="text-sm font-semibold text-cyan-200">3D view unavailable</p>
          <p className="mt-2 text-sm text-slate-300">
            The hologram could not be rendered on this device. Search, voice commands and the knowledge panel still work.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="mt-4 rounded-xl border border-cyan-300/40 px-3 py-1.5 text-sm text-cyan-100 hover:bg-cyan-400/10"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
