import "server-only";
import { supabaseServer } from "./supabase/server";
import type { CaptureRow, EdgeRow, EventRow, NodeRow, Pass1Label } from "./types";

export interface MapNode extends NodeRow {
  stallCount: number;
  lastEventAt: string;
  captureId: string | null;
  pass1Label: Pass1Label | null;
  corrected: boolean;
}

export interface MapData {
  nodes: MapNode[];
  edges: EdgeRow[];
  gutter: MapNode[];
}

export async function getMapData(): Promise<MapData> {
  const sb = supabaseServer();

  const [
    { data: nodes, error: nodesErr },
    { data: edges, error: edgesErr },
    { data: events, error: eventsErr },
    { data: captures, error: capturesErr },
  ] = await Promise.all([
    sb.from("nodes").select("*").order("created_at", { ascending: true }),
    sb.from("edges").select("*"),
    sb.from("events").select("node_id, kind, at").order("at", { ascending: true }),
    sb.from("captures").select("id, node_id, classification_json, corrected").order("created_at", { ascending: true }),
  ]);

  if (nodesErr) throw nodesErr;
  if (edgesErr) throw edgesErr;
  if (eventsErr) throw eventsErr;
  if (capturesErr) throw capturesErr;

  const stallByNode = new Map<string, number>();
  const lastByNode = new Map<string, string>();
  for (const ev of (events ?? []) as Pick<EventRow, "node_id" | "kind" | "at">[]) {
    if (ev.kind === "revised" || ev.kind === "started" || ev.kind === "abandoned") {
      stallByNode.set(ev.node_id, (stallByNode.get(ev.node_id) ?? 0) + 1);
    }
    lastByNode.set(ev.node_id, ev.at);
  }

  // Last capture per node wins (a node can in principle receive more than
  // one capture over time; the most recent one drives the chip).
  const captureByNode = new Map<string, Pick<CaptureRow, "id" | "classification_json" | "corrected">>();
  for (const c of (captures ?? []) as Array<Pick<CaptureRow, "id" | "node_id" | "classification_json" | "corrected">>) {
    if (c.node_id) captureByNode.set(c.node_id, c);
  }

  const enriched: MapNode[] = ((nodes ?? []) as NodeRow[]).map((n) => {
    const capture = captureByNode.get(n.id);
    return {
      ...n,
      stallCount: stallByNode.get(n.id) ?? 0,
      lastEventAt: lastByNode.get(n.id) ?? n.last_touched_at,
      captureId: capture?.id ?? null,
      pass1Label: capture?.classification_json?.pass1?.label ?? null,
      corrected: capture?.corrected ?? false,
    };
  });

  return {
    nodes: enriched,
    edges: (edges ?? []) as EdgeRow[],
    gutter: enriched.filter((n) => n.x == null || n.y == null),
  };
}

export async function getCapture(id: string): Promise<CaptureRow | null> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("captures").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getRecentNodeTitles(limit = 60): Promise<string[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("nodes")
    .select("title")
    .order("last_touched_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Array<{ title: string }>).map((r) => r.title);
}
