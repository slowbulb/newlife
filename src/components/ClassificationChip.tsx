"use client";

import { useState, useTransition } from "react";
import { correctPass1 } from "@/app/actions";
import { PASS1_LABELS } from "@/lib/types";
import type { Pass1Label } from "@/lib/types";

const SHORT_LABEL: Record<Pass1Label, string> = {
  "thing-I-want-to-be": "want to be",
  "thing-to-do": "to do",
  "thing-to-have": "to have",
  "thing-to-stop": "to stop",
  "thing-in-the-way": "in the way",
  unsorted: "unsorted",
};

export default function ClassificationChip({
  captureId,
  label,
  corrected,
}: {
  captureId: string;
  label: Pass1Label | null;
  corrected: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Pass1Label | null>(null);

  const shown = optimistic ?? label;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded-full border px-2 py-0.5 text-[11px] leading-tight transition-colors ${
          shown
            ? "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--ink-dim)] hover:text-[var(--ink)]"
            : "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] animate-pulse"
        }`}
        title={corrected ? "Corrected by you" : "Tap to correct"}
      >
        {shown ? SHORT_LABEL[shown] : "classifying…"}
        {corrected && shown ? " ✓" : ""}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 flex w-40 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl fade-in">
          {PASS1_LABELS.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={pending}
              onClick={() => {
                setOptimistic(opt);
                setOpen(false);
                startTransition(() => {
                  correctPass1(captureId, opt);
                });
              }}
              className={`px-3 py-1.5 text-left text-xs hover:bg-white/5 ${
                opt === shown ? "text-[var(--accent)]" : "text-[var(--ink)]"
              }`}
            >
              {SHORT_LABEL[opt]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
