"use client";

import { useEffect, useRef, useState } from "react";
import { submitCapture } from "@/app/actions";

export default function CaptureInput({ gutterOpen }: { gutterOpen: boolean }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  async function submit() {
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    setValue("");
    try {
      await submitCapture(text);
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
    </div>
  );
}
