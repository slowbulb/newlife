"use client";

import { typeColour } from "@/lib/taxonomy";
import ClassificationChip from "./ClassificationChip";
import type { MapNode } from "@/lib/queries";

export default function Gutter({
  nodes,
  onPlace,
  collapsed,
  onToggle,
}: {
  nodes: MapNode[];
  onPlace: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`absolute right-0 top-0 z-20 flex h-full flex-col border-l border-[var(--border)] bg-[var(--bg-elevated)]/95 backdrop-blur transition-all ${
        collapsed ? "w-10" : "w-72"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--ink-dim)] hover:text-[var(--ink)]"
      >
        {!collapsed && <span>gutter · {nodes.length}</span>}
        <span>{collapsed ? "‹" : "›"}</span>
      </button>
      {!collapsed && (
        <div className="flex-1 space-y-2 overflow-y-auto p-2">
          {nodes.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-[var(--ink-dim)]">Empty. Type a thought above.</p>
          )}
          {nodes.map((n) => (
            <div
              key={n.id}
              className="glow rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 fade-in"
            >
              <div className="mb-1 flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: typeColour(n.type) }} />
                <span className="truncate text-xs text-[var(--ink)]">{n.title}</span>
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {n.captureId && (
                  <ClassificationChip captureId={n.captureId} label={n.pass1Label} corrected={n.corrected} />
                )}
              </div>
              <button
                onClick={() => onPlace(n.id)}
                className="w-full rounded border border-[var(--border)] py-1 text-[11px] text-[var(--ink-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                place on map →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
