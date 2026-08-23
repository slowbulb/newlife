"use client";

import { useRef, useState } from "react";
import { createEdge, updateNodePosition } from "@/app/actions";
import NodeCard, { type ZoomLevel } from "./NodeCard";
import type { MapNode } from "@/lib/queries";
import type { EdgeRow, EdgeType } from "@/lib/types";

function zoomLevel(scale: number): ZoomLevel {
  if (scale < 0.5) return "far";
  if (scale < 1.15) return "mid";
  return "close";
}

const EDGE_STYLE: Record<string, { stroke: string; dash?: string }> = {
  serves: { stroke: "#4caf7d55" },
  blocks: { stroke: "#e6394688", dash: "4 3" },
};

export default function Canvas({
  nodes,
  edges,
  placing,
  onPlaced,
  onPositionChange,
  soloId,
  onOpenSolo,
}: {
  nodes: MapNode[];
  edges: EdgeRow[];
  placing: string | null;
  onPlaced: () => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  soloId: string | null;
  onOpenSolo: (id: string) => void;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.9);
  const [dragging, setDragging] = useState<
    { kind: "pan"; startX: number; startY: number; panX: number; panY: number } |
    { kind: "node"; id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null
  >(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const level = zoomLevel(scale);

  const placed = nodes.filter((n) => n.x != null && n.y != null);
  const visible = soloId
    ? lineage(placed, edges, soloId)
    : placed;

  function screenToCanvas(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / scale,
      y: (clientY - rect.top - pan.y) / scale,
    };
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY * 0.0012;
    setScale((s) => Math.min(2.5, Math.max(0.15, s + delta * s)));
  }

  function onMouseDownBackground(e: React.MouseEvent) {
    if (placing) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      onPositionChange(placing, x, y); // local update first — don't wait on realtime to see it land
      updateNodePosition(placing, x, y);
      onPlaced();
      return;
    }
    setDragging({ kind: "pan", startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
  }

  function onNodeMouseDown(node: MapNode, e: React.MouseEvent) {
    e.stopPropagation();
    if (linkMode) {
      if (!linkFrom) {
        setLinkFrom(node.id);
      } else if (linkFrom !== node.id) {
        const type: EdgeType = e.shiftKey ? "blocks" : "serves";
        createEdge(linkFrom, node.id, type);
        setLinkFrom(null);
      }
      return;
    }
    setDragging({ kind: "node", id: node.id, startX: e.clientX, startY: e.clientY, nodeX: node.x ?? 0, nodeY: node.y ?? 0 });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    if (dragging.kind === "pan") {
      setPan({ x: dragging.panX + (e.clientX - dragging.startX), y: dragging.panY + (e.clientY - dragging.startY) });
    } else {
      const dx = (e.clientX - dragging.startX) / scale;
      const dy = (e.clientY - dragging.startY) / scale;
      const el = document.getElementById(`node-${dragging.id}`);
      if (el) el.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
    }
  }

  function onMouseUp(e: React.MouseEvent) {
    if (dragging?.kind === "node") {
      const dx = (e.clientX - dragging.startX) / scale;
      const dy = (e.clientY - dragging.startY) / scale;
      const el = document.getElementById(`node-${dragging.id}`);
      if (el) el.style.transform = "";
      const nx = dragging.nodeX + dx;
      const ny = dragging.nodeY + dy;
      onPositionChange(dragging.id, nx, ny);
      updateNodePosition(dragging.id, nx, ny);
    }
    setDragging(null);
  }

  return (
    <div className="relative z-0 h-full w-full overflow-hidden">
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 text-xs text-[var(--ink-dim)]">
        {soloId && (
          <button
            className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 hover:text-[var(--ink)]"
            onClick={() => onOpenSolo("")}
          >
            ← exit solo (esc)
          </button>
        )}
        <button
          className={`rounded-full border px-3 py-1 ${
            linkMode ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--bg-elevated)]"
          }`}
          onClick={() => {
            setLinkMode((m) => !m);
            setLinkFrom(null);
          }}
        >
          {linkMode ? (linkFrom ? "pick target…" : "pick source…") : "link"}
        </button>
        <span>{Math.round(scale * 100)}%</span>
      </div>

      {placing && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[#1a1400] shadow-lg">
          Click anywhere to place it
        </div>
      )}

      <div
        ref={containerRef}
        className="canvas-grid h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={onMouseDownBackground}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => setDragging(null)}
      >
        <div
          className="relative h-full w-full origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
        >
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible">
            {edges
              .filter((e) => visible.some((n) => n.id === e.from_id) && visible.some((n) => n.id === e.to_id))
              .map((e) => {
                const from = placed.find((n) => n.id === e.from_id);
                const to = placed.find((n) => n.id === e.to_id);
                if (!from || !to) return null;
                const style = EDGE_STYLE[e.type] ?? { stroke: "#6c757d55", dash: "2 4" };
                return (
                  <line
                    key={e.id}
                    x1={from.x!}
                    y1={from.y!}
                    x2={to.x!}
                    y2={to.y!}
                    stroke={e.undecided ? "#f5c51888" : style.stroke}
                    strokeWidth={2}
                    strokeDasharray={e.undecided ? "1 4" : style.dash}
                  />
                );
              })}
          </svg>

          {visible.map((n) => (
            <div key={n.id} id={`node-${n.id}`} style={{ position: "absolute", left: 0, top: 0 }}>
              <NodeCard
                node={n}
                zoom={level}
                onDragStart={(e) => onNodeMouseDown(n, e)}
                onOpenSolo={onOpenSolo}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function lineage(nodes: MapNode[], edges: EdgeRow[], rootId: string): MapNode[] {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      if (ids.has(e.from_id) && !ids.has(e.to_id)) {
        ids.add(e.to_id);
        changed = true;
      }
      if (ids.has(e.to_id) && !ids.has(e.from_id)) {
        ids.add(e.from_id);
        changed = true;
      }
    }
  }
  return nodes.filter((n) => ids.has(n.id));
}
