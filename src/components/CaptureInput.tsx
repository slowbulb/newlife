"use client";

import { useEffect, useRef, useState } from "react";
import { submitCapture } from "@/app/actions";

export default function CaptureInput({
  gutterOpen,
  onCaptured,
}: {
  gutterOpen: boolean;
  onCaptured: (nodeId: string, captureId: string, text: string) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  async function submit() {
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    setValue("");
    setError(null);
    try {
      const { nodeId, captureId } = await submitCapture(text);
      onCaptured(nodeId, captureId, text);
    } catch (err) {
      setValue(text); // don't lose the thought on failure
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setBusy(false);
      ref.current?.focus();
    }
  }

  return (
    <div
      className={`absolute left-1/2 top-6 z-20 w-[min(90vw,560px)] -translate-x-1/2 transition-all ${
        gutterOpen ? "" : ""
      }`}
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        placeholder="What's on your mind…"
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        className="w-full resize-none overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/90 px-4 py-3 text-sm text-[var(--ink)] shadow-2xl outline-none backdrop-blur placeholder:text-[var(--ink-dim)] focus:border-[var(--accent)]/60"
      />
      {error && (
        <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-center text-xs text-red-300 fade-in">
          {error}
        </p>
      )}
    </div>
  );
}
