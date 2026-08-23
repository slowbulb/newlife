"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import Canvas from "./Canvas";
import CaptureInput from "./CaptureInput";
import Gutter from "./Gutter";
import type { MapNode } from "@/lib/queries";
import type { EdgeRow, NodeRow } from "@/lib/types";

export default function MapView({
  initialNodes,
  initialEdges,
}: {
  initialNodes: MapNode[];
  initialEdges: EdgeRow[];
}) {
  const [nodes, setNodes] = useState<MapNode[]>(initialNodes);
  const [edges, setEdges] = useState<EdgeRow[]>(initialEdges);
  const [placing, setPlacing] = useState<string | null>(null);
  const [soloId, setSoloId] = useState<string | null>(null);
  const [gutterCollapsed, setGutterCollapsed] = useState(false);

  // Capture never blocks on the model, but the person typing still deserves
  // to see it land — this doesn't wait for realtime (which requires a table
  // to be added to the `supabase_realtime` publication; see
  // supabase/migrations/0002_realtime.sql) at all.
  const addOptimisticCapture = useCallback((nodeId: string, captureId: string, text: string) => {
    const now = new Date().toISOString();
    setNodes((prev) => {
      if (prev.some((n) => n.id === nodeId)) return prev;
      const stub: MapNode = {
        id: nodeId,
        type: "unsorted",
        title: text.length > 140 ? text.slice(0, 140) + "…" : text,
        body: text,
        status: "unsorted",
        terminal_form: null,
        owner: null,
        external_holder: null,
        due_date: null,
        irreversible: false,
        cost_money: null,
        cost_hours: null,
        cost_exposure: null,
        domain: null,
        lane: null,
        x: null,
        y: null,
        created_at: now,
        updated_at: now,
        last_touched_at: now,
        stallCount: 0,
        lastEventAt: now,
        captureId,
        pass1Label: null,
        corrected: false,
      };
      return [...prev, stub];
    });
  }, []);

  // Same reasoning as addOptimisticCapture: don't make placing/dragging a
  // node wait on realtime to be reflected back into view.
  const setLocalPosition = useCallback((id: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }, []);

  const upsertNode = useCallback((row: NodeRow) => {
    setNodes((prev) => {
      const idx = prev.findIndex((n) => n.id === row.id);
      const enriched: MapNode = {
        ...row,
        stallCount: idx >= 0 ? prev[idx].stallCount : 0,
        lastEventAt: idx >= 0 ? prev[idx].lastEventAt : row.last_touched_at,
        captureId: idx >= 0 ? prev[idx].captureId : null,
        pass1Label: idx >= 0 ? prev[idx].pass1Label : null,
        corrected: idx >= 0 ? prev[idx].corrected : false,
      };
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = { ...next[idx], ...enriched };
        return next;
      }
      return [...prev, enriched];
    });
  }, []);

  useEffect(() => {
    let sb: ReturnType<typeof supabaseBrowser>;
    try {
      sb = supabaseBrowser();
    } catch {
      return; // NEXT_PUBLIC_SUPABASE_* not set — realtime just stays off.
    }

    const channel = sb
      .channel("life-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "nodes" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setNodes((prev) => prev.filter((n) => n.id !== (payload.old as NodeRow).id));
        } else {
          upsertNode(payload.new as NodeRow);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "edges" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setEdges((prev) => prev.filter((e) => e.id !== (payload.old as EdgeRow).id));
        } else {
          setEdges((prev) => {
            const row = payload.new as EdgeRow;
            const idx = prev.findIndex((e) => e.id === row.id);
            if (idx >= 0) {
              const next = prev.slice();
              next[idx] = row;
              return next;
            }
            return [...prev, row];
          });
        }
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "captures" },
        (payload) => {
          const row = payload.new as {
            id: string;
            node_id: string | null;
            classification_json: { pass1?: { label: MapNode["pass1Label"] } } | null;
            corrected: boolean;
          };
          if (!row.node_id) return;
          setNodes((prev) =>
            prev.map((n) =>
              n.id === row.node_id
                ? {
                    ...n,
                    captureId: row.id,
                    pass1Label: row.classification_json?.pass1?.label ?? n.pass1Label,
                    corrected: row.corrected,
                  }
                : n,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [upsertNode]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (placing) setPlacing(null);
        else if (soloId) setSoloId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing, soloId]);

  const gutter = nodes.filter((n) => n.x == null || n.y == null);

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-[var(--bg)]">
      <Canvas
        nodes={nodes}
        edges={edges}
        placing={placing}
        onPlaced={() => setPlacing(null)}
        onPositionChange={setLocalPosition}
        soloId={soloId}
        onOpenSolo={(id) => setSoloId(id || null)}
      />
      <CaptureInput gutterOpen={!gutterCollapsed} onCaptured={addOptimisticCapture} />
      <Gutter
        nodes={gutter}
        onPlace={(id) => setPlacing(id)}
        collapsed={gutterCollapsed}
        onToggle={() => setGutterCollapsed((c) => !c)}
      />
    </div>
  );
}
