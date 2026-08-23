"use server";

import { after } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { classifyPass1, classifyPass2 } from "@/lib/classify";
import { getCapture, getRecentNodeTitles } from "@/lib/queries";
import type { EdgeType, NodeType, Pass1Label, TerminalForm } from "@/lib/types";

/**
 * Capture never blocks: this writes the raw text as a real `unsorted` node
 * immediately and returns. Classification runs in `after()`, off the
 * response, so the input box is never waiting on the model (principle #1).
 */
export async function submitCapture(rawText: string): Promise<{ nodeId: string; captureId: string }> {
  const text = rawText.trim();
  if (!text) throw new Error("Empty capture");
  const sb = supabaseServer();

  const { data: node, error: nodeErr } = await sb
    .from("nodes")
    .insert({
      type: "unsorted",
      title: text.length > 140 ? text.slice(0, 140) + "…" : text,
      body: text,
      status: "unsorted",
    })
    .select("id")
    .single();
  if (nodeErr) throw nodeErr;
  const nodeId = (node as { id: string }).id;

  const { data: capture, error: capErr } = await sb
    .from("captures")
    .insert({ raw_text: text, node_id: nodeId })
    .select("id")
    .single();
  if (capErr) throw capErr;
  const captureId = (capture as { id: string }).id;

  await sb.from("events").insert({ node_id: nodeId, kind: "created" });

  after(() => runClassification(captureId));

  return { nodeId, captureId };
}

/**
 * Runs (or re-runs) both classification passes for a capture and applies the
 * result to its node. `forcedPass1` skips the pass-1 call when the user has
 * already corrected the chip — pass 2 still re-runs so enrichment reflects
 * the correction.
 */
export async function runClassification(captureId: string, forcedPass1?: Pass1Label): Promise<void> {
  const sb = supabaseServer();
  const capture = await getCapture(captureId);
  if (!capture) return;

  try {
    const pass1 = forcedPass1 ? { label: forcedPass1 } : await classifyPass1(capture.raw_text);
    const candidateTitles = await getRecentNodeTitles();
    const pass2 = await classifyPass2(capture.raw_text, pass1.label, candidateTitles);

    await sb
      .from("captures")
      .update({ classification_json: { pass1, pass2 } })
      .eq("id", captureId);

    if (!capture.node_id) return;
    const primaryId = capture.node_id;

    await sb
      .from("nodes")
      .update({
        type: pass2.node.type,
        title: pass2.node.title || capture.raw_text.slice(0, 140),
        terminal_form: pass2.node.terminal_form,
        domain: pass2.node.domain,
        lane: pass2.node.lane,
        owner: pass2.node.owner,
        external_holder: pass2.node.external_holder,
        due_date: pass2.node.due_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", primaryId);

    for (const extra of pass2.additional_nodes) {
      const { data: extraNode, error } = await sb
        .from("nodes")
        .insert({ type: extra.type, title: extra.title, terminal_form: extra.terminal_form })
        .select("id")
        .single();
      if (error || !extraNode) continue;
      await sb.from("edges").insert({
        from_id: primaryId,
        to_id: (extraNode as { id: string }).id,
        type: extra.relation,
      });
      await sb.from("events").insert({ node_id: (extraNode as { id: string }).id, kind: "created", note: "split from capture" });
    }

    if (pass2.suggested_edges.length) {
      const { data: existing } = await sb.from("nodes").select("id, title").neq("id", primaryId);
      const byTitle = new Map(((existing ?? []) as Array<{ id: string; title: string }>).map((n) => [n.title.toLowerCase(), n.id]));
      for (const edge of pass2.suggested_edges) {
        const toId = byTitle.get(edge.to_title.toLowerCase());
        if (!toId) continue;
        await sb.from("edges").insert({ from_id: primaryId, to_id: toId, type: edge.type });
      }
    }

    await sb.from("events").insert({ node_id: primaryId, kind: "revised", note: "classified" });
  } catch (err) {
    // Classification failure must never lose the capture — it just stays
    // `unsorted`, which is a legitimate resting state, not an error state.
    console.error("classification failed", captureId, err);
  }
}

export async function correctPass1(captureId: string, label: Pass1Label): Promise<void> {
  const sb = supabaseServer();
  const capture = await getCapture(captureId);
  if (!capture) return;

  const prevJson = (capture.classification_json ?? {}) as Record<string, unknown>;
  await sb
    .from("captures")
    .update({ classification_json: { ...prevJson, pass1: { label } }, corrected: true })
    .eq("id", captureId);

  after(() => runClassification(captureId, label));
}

export async function updateNodePosition(nodeId: string, x: number, y: number): Promise<void> {
  const sb = supabaseServer();
  const { error } = await sb.from("nodes").update({ x, y }).eq("id", nodeId);
  if (error) throw error;
}

export interface NodePatch {
  title?: string;
  body?: string | null;
  type?: NodeType;
  status?: string | null;
  terminal_form?: TerminalForm;
  owner?: string | null;
  external_holder?: string | null;
  due_date?: string | null;
  irreversible?: boolean;
  cost_money?: number | null;
  cost_hours?: number | null;
  cost_exposure?: string | null;
  domain?: string | null;
  lane?: string | null;
}

export async function updateNode(nodeId: string, patch: NodePatch): Promise<void> {
  const sb = supabaseServer();
  const { error } = await sb
    .from("nodes")
    .update({ ...patch, updated_at: new Date().toISOString(), last_touched_at: new Date().toISOString() })
    .eq("id", nodeId);
  if (error) throw error;
  await sb.from("events").insert({ node_id: nodeId, kind: "touched" });
}

export async function logNodeEvent(
  nodeId: string,
  kind: "started" | "abandoned" | "completed" | "revised" | "touched",
  note?: string,
): Promise<void> {
  const sb = supabaseServer();
  await sb.from("events").insert({ node_id: nodeId, kind, note: note ?? null });
  await sb.from("nodes").update({ last_touched_at: new Date().toISOString() }).eq("id", nodeId);
}

export async function createEdge(
  fromId: string,
  toId: string,
  type: EdgeType = "serves",
  undecided = false,
): Promise<void> {
  if (fromId === toId) return;
  const sb = supabaseServer();
  const { error } = await sb.from("edges").insert({ from_id: fromId, to_id: toId, type, undecided });
  if (error) throw error;
}

export async function deleteEdge(edgeId: string): Promise<void> {
  const sb = supabaseServer();
  await sb.from("edges").delete().eq("id", edgeId);
}

/**
 * Retroactive/unplanned win: creates an `evidence` node that never went
 * through capture, optionally attached upward to the identity it served
 * (§5 — must accept things that were never on any list, and history from
 * years ago, not just start the log at zero).
 */
export async function addEvidence(
  title: string,
  body: string | null,
  occurredAt: string,
  identityNodeId?: string,
): Promise<string> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("nodes")
    .insert({
      type: "evidence",
      title,
      body,
      created_at: occurredAt,
      last_touched_at: occurredAt,
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  await sb.from("events").insert({ node_id: id, kind: "completed", at: occurredAt });
  if (identityNodeId) {
    await sb.from("edges").insert({ from_id: id, to_id: identityNodeId, type: "evidence-for" as EdgeType });
  }
  return id;
}
