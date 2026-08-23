// One-off seed: loads seed/song_index.json (256 songs indexed from 1,252
// audio files) into the graph so the map isn't empty on day one, and
// exercises §6/§7's undecided member-of edges and version-count stall data
// for real. Safe to re-run — it skips songs that already exist by title.
//
// Usage: npm run seed:songs   (reads .env for SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)

try {
  process.loadEnvFile();
} catch {
  // no .env file — assume env vars are already set in the shell
}

import { createClient } from "@supabase/supabase-js";

interface SongEntry {
  title_guess: string;
  versions: number;
  best_status: string;
  projects: string[];
  first: string;
  last: string;
  engineer_mixes: number;
  engineer_mix_dates: string;
  total_mb: number;
}

const PROJECTS = ["Loamtree", "Lonelyloops", "Mishra Tempo Service", "Ruby Cinema", "Songwaters"];
const IDENTITY_TITLE = "The kind of musician I want to be";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example) first.");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(new URL("../seed/song_index.json", import.meta.url), "utf8");
  const data: SongEntry[] = JSON.parse(raw);
  console.log(`Loaded ${data.length} songs.`);

  async function findOrCreateNode(title: string, fields: Record<string, unknown>) {
    const { data: existing } = await sb.from("nodes").select("id").eq("title", title).maybeSingle();
    if (existing) return (existing as { id: string }).id;
    const { data: created, error } = await sb.from("nodes").insert({ title, ...fields }).select("id").single();
    if (error) throw error;
    return (created as { id: string }).id;
  }

  const identityId = await findOrCreateNode(IDENTITY_TITLE, {
    type: "identity",
    domain: "music",
    lane: "music",
    x: 0,
    y: 0,
  });

  const projectIds = new Map<string, string>();
  for (let i = 0; i < PROJECTS.length; i++) {
    const name = PROJECTS[i];
    const id = await findOrCreateNode(name, {
      type: "project",
      domain: "music",
      lane: "music",
      x: 420,
      y: (i - (PROJECTS.length - 1) / 2) * 240,
    });
    projectIds.set(name, id);
    await sb.from("edges").insert({ from_id: id, to_id: identityId, type: "serves" }).select().maybeSingle();
  }

  const columnCounters = new Map<string, number>();
  const UNASSIGNED_Y = 1500;
  let unassignedIndex = 0;

  for (const song of data) {
    const { data: existing } = await sb.from("nodes").select("id").eq("title", song.title_guess).maybeSingle();
    if (existing) continue; // already seeded

    const primaryProject = song.projects[0] ?? null;
    const anchorIndex = primaryProject ? PROJECTS.indexOf(primaryProject) : -1;

    let x: number;
    let y: number;
    if (anchorIndex >= 0) {
      const col = columnCounters.get(primaryProject!) ?? 0;
      columnCounters.set(primaryProject!, col + 1);
      const row = Math.floor(col / 6);
      const c = col % 6;
      x = 780 + c * 210 + (Math.random() * 30 - 15);
      y = (anchorIndex - (PROJECTS.length - 1) / 2) * 240 + row * 150 + (Math.random() * 30 - 15);
    } else {
      const row = Math.floor(unassignedIndex / 10);
      const c = unassignedIndex % 10;
      unassignedIndex++;
      x = 420 + c * 210;
      y = UNASSIGNED_Y + row * 150;
    }

    const body = `${song.versions} takes across ${song.engineer_mix_dates || "unknown dates"}. Best status: ${song.best_status}.`;

    const { data: node, error } = await sb
      .from("nodes")
      .insert({
        type: "project",
        title: song.title_guess,
        body,
        status: song.best_status,
        domain: "music",
        lane: "music",
        x,
        y,
        created_at: song.first,
        updated_at: song.last,
        last_touched_at: song.last,
      })
      .select("id")
      .single();
    if (error) {
      console.error("failed to insert", song.title_guess, error.message);
      continue;
    }
    const nodeId = (node as { id: string }).id;

    for (const projectName of song.projects) {
      const pid = projectIds.get(projectName);
      if (!pid) continue;
      await sb.from("edges").insert({
        from_id: nodeId,
        to_id: pid,
        type: "member-of",
        undecided: song.projects.length > 1,
      });
    }

    const firstMs = Date.parse(song.first);
    const lastMs = Date.parse(song.last);
    const span = Math.max(lastMs - firstMs, 0);
    const events: Array<{ node_id: string; kind: string; at: string; note: string | null }> = [
      { node_id: nodeId, kind: "created", at: song.first, note: null },
    ];
    const revisions = Math.max(song.versions - 1, 0);
    for (let v = 0; v < revisions; v++) {
      const t = revisions === 1 ? span : (span * (v + 1)) / (revisions + 1);
      events.push({ node_id: nodeId, kind: "revised", at: new Date(firstMs + t).toISOString(), note: null });
    }
    if (song.best_status === "mastered") {
      events.push({ node_id: nodeId, kind: "completed", at: song.last, note: "mastered" });
    }
    // Batch insert in chunks to stay well under request size limits.
    for (let i = 0; i < events.length; i += 200) {
      await sb.from("events").insert(events.slice(i, i + 200));
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
