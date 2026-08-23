"use client";

import { useState, useTransition } from "react";
import { logNodeEvent, updateNode } from "@/app/actions";
import ClassificationChip from "./ClassificationChip";
import { typeColour } from "@/lib/taxonomy";
import type { MapNode } from "@/lib/queries";

export type ZoomLevel = "far" | "mid" | "close";

const STATUS_OPTIONS = ["", "sketch", "active", "blocked", "sidelined", "done"];

export default function NodeCard({
  node,
  zoom,
  onDragStart,
  onOpenSolo,
}: {
  node: MapNode;
  zoom: ZoomLevel;
  onDragStart?: (e: React.MouseEvent) => void;
  onOpenSolo?: (id: string) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [body, setBody] = useState(node.body ?? "");
  const [, startTransition] = useTransition();
  // Captured once per mount rather than read live during render, per React's
  // purity rules — "cold" only needs to be roughly right, not live-ticking.
  const [now] = useState(() => Date.now());

  const colour = typeColour(node.type);
  const cold = now - new Date(node.lastEventAt).getTime() > 1000 * 60 * 60 * 24 * 21; // 3 weeks
  const hasHolderlessDate = !!node.due_date && !node.external_holder;
  const isRedDecision = node.type === "decision" && (!node.owner || node.owner.toLowerCase() === "us");

  function saveTitle() {
    setEditingTitle(false);
    if (title !== node.title) startTransition(() => updateNode(node.id, { title }));
  }
  function saveBody() {
    setEditingBody(false);
    if (body !== (node.body ?? "")) startTransition(() => updateNode(node.id, { body }));
  }

  const weight = 32 + Math.min(node.stallCount, 20) * 2;

  if (zoom === "far") {
    if (node.type !== "identity") return null;
    return (
      <div
        className="absolute flex -translate-x-1/2 -translate-y-1/2 select-none flex-col items-center gap-1"
        style={{ left: node.x ?? 0, top: node.y ?? 0 }}
        onMouseDown={onDragStart}
      >
        <div
          className="rounded-full opacity-80 blur-[1px]"
          style={{ width: weight * 2, height: weight * 2, background: colour }}
        />
        <span className="text-xs font-medium text-[var(--ink)]">{node.title}</span>
      </div>
    );
  }

  if (zoom === "mid") {
    return (
      <button
        type="button"
        onMouseDown={onDragStart}
        onDoubleClick={() => onOpenSolo?.(node.id)}
        className={`absolute w-44 -translate-x-1/2 -translate-y-1/2 rounded-lg border px-3 py-2 text-left shadow-md transition-opacity ${
          cold ? "opacity-50 saturate-50" : "opacity-100"
        }`}
        style={{
          left: node.x ?? 0,
          top: node.y ?? 0,
          borderColor: "var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colour }} />
          <span className="truncate text-xs font-medium text-[var(--ink)]">{node.title}</span>
        </div>
      </button>
    );
  }

  return (
    <div
      className={`absolute w-64 -translate-x-1/2 -translate-y-1/2 rounded-xl border p-3 shadow-lg fade-in ${
        cold ? "opacity-60 saturate-50" : "opacity-100"
      }`}
      style={{ left: node.x ?? 0, top: node.y ?? 0, borderColor: "var(--border)", background: "var(--bg-elevated)" }}
    >
      <div className="mb-1.5 flex cursor-move items-center gap-1.5" onMouseDown={onDragStart}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colour }} />
        <span className="text-[10px] uppercase tracking-wide text-[var(--ink-dim)]">{node.type}</span>
        {node.stallCount >= 3 && (
          <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--ink-dim)]">
            {node.stallCount}×
          </span>
        )}
      </div>

      {editingTitle ? (
        <input
          autoFocus
          className="mb-1 w-full rounded border border-[var(--border)] bg-transparent px-1 py-0.5 text-sm text-[var(--ink)] outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && saveTitle()}
        />
      ) : (
        <p
          className="mb-1 cursor-text text-sm font-medium text-[var(--ink)]"
          onClick={() => setEditingTitle(true)}
        >
          {node.title}
        </p>
      )}

      {editingBody ? (
        <textarea
          autoFocus
          rows={3}
          className="mb-1.5 w-full resize-none rounded border border-[var(--border)] bg-transparent px-1 py-0.5 text-xs text-[var(--ink-dim)] outline-none"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={saveBody}
        />
      ) : (
        <p
          className="mb-1.5 min-h-[1em] cursor-text whitespace-pre-wrap text-xs text-[var(--ink-dim)]"
          onClick={() => setEditingBody(true)}
        >
          {node.body || "…"}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {node.captureId && <ClassificationChip captureId={node.captureId} label={node.pass1Label} corrected={node.corrected} />}
        {node.due_date && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] ${
              hasHolderlessDate
                ? "border-dashed border-[var(--ink-dim)] text-[var(--ink-dim)]"
                : "border-[var(--accent)]/50 text-[var(--accent)]"
            }`}
            title={hasHolderlessDate ? "No external holder — this is a wish, not a deadline" : `Held by ${node.external_holder}`}
          >
            {node.due_date}
          </span>
        )}
        {isRedDecision && (
          <span className="rounded-full border border-red-500/50 px-2 py-0.5 text-[10px] text-red-400">
            no owner
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1 border-t border-[var(--border)] pt-2">
        <select
          className="rounded border border-[var(--border)] bg-transparent px-1 py-0.5 text-[10px] text-[var(--ink-dim)] outline-none"
          value={node.status ?? ""}
          onChange={(e) => startTransition(() => updateNode(node.id, { status: e.target.value || null }))}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="bg-[var(--bg-elevated)]">
              {s || "—"}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            title="Log touched"
            className="rounded px-1.5 py-0.5 text-[10px] text-[var(--ink-dim)] hover:bg-white/5 hover:text-[var(--ink)]"
            onClick={() => startTransition(() => logNodeEvent(node.id, "touched"))}
          >
            touch
          </button>
          <button
            type="button"
            title="Mark completed"
            className="rounded px-1.5 py-0.5 text-[10px] text-[var(--ink-dim)] hover:bg-white/5 hover:text-[var(--ink)]"
            onClick={() => startTransition(() => logNodeEvent(node.id, "completed"))}
          >
            done
          </button>
        </div>
      </div>
    </div>
  );
}
