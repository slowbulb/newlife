# life-map

A personal thinking-and-goals system for one user. One input box: type any
thought and it's classified (async, never blocking capture) and placed on a
navigable, pan/zoom map of the kind of person you want to be, what you want
to do and have, what's in the way, and what you've actually done.

Full design rationale lives in the build brief this was scaffolded from —
keep it next to this repo; the "why" behind almost every decision below
(why five terminal forms, why `external_holder`, why the gutter never
auto-scatters) is there, not repeated here.

## Stack

- **Next.js 16 (App Router)** + TypeScript + Tailwind CSS
- **Supabase** (Postgres) — one `nodes` table with a `type` column, not a
  table per type, because the taxonomy (`supabase/migrations/0001_init.sql`
  → `types` table) is expected to change often
- **Claude API**, two-pass structured-output classification
  (`src/lib/classify.ts`)
- **Canvas**: plain React + SVG/CSS transforms — no graph library

## Getting started

1. Create a Supabase project. In the SQL editor, run
   `supabase/migrations/0001_init.sql` once.
2. Copy `.env.example` to `.env` and fill in the Supabase URL/keys (Project
   Settings → API) and `ANTHROPIC_API_KEY`.
3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   Open <http://localhost:3000> — the cursor lands in the input box
   immediately.

4. Optional: seed the music region from the 256-song index so the map isn't
   empty on day one:

   ```bash
   npm run seed:songs
   ```

## Security

**There is no login in v1** — see "Do not build" in the brief (no settings
screen, no onboarding; this is a closed, single-user tool). The Supabase
anon key is granted full read/write via RLS policy so the browser can hold
a realtime subscription without a session. That means anyone who can reach
the deployed URL and knows (or finds) the anon key can read and write
everything. **Do not deploy this publicly reachable.** On Vercel, turn on
[Deployment Protection](https://vercel.com/docs/deployment-protection) (or
put it behind a VPN/tailnet) before pointing it at a real `SUPABASE_URL`.

## How capture works

`submitCapture` (`src/app/actions.ts`) writes the raw text as a real `nodes`
row with `type = 'unsorted'` and returns immediately — capture never waits
on the model. Classification runs afterward via Next's `after()`:

1. **Pass 1** — a fast, six-way triage (`thing-I-want-to-be` /
   `thing-to-do` / `thing-to-have` / `thing-to-stop` / `thing-in-the-way` /
   `unsorted`). Shown as a small chip on the node, tappable to correct.
2. **Pass 2** — enrichment: the specific taxonomy type, terminal form,
   domain, `owner`/`external_holder`/`due_date`, whether the capture is
   really more than one node (`additional_nodes`), and confident edges to
   existing nodes (`suggested_edges`).

Correcting the pass-1 chip (`correctPass1`) re-runs pass 2 with the
correction as a hint, so enrichment updates too.

If `ANTHROPIC_API_KEY` is unset or the call fails, the node simply stays
`unsorted` — a legitimate resting state, not an error. Nothing is lost;
`captures.raw_text` keeps the original text forever regardless of what
classification later does with it.

## The gutter and placement

A node with `x`/`y` unset is "in the gutter" (`src/components/Gutter.tsx`)
regardless of classification state — classification never implies a canvas
position, so nothing auto-scatters into the middle. Click "place on map",
then click anywhere on the canvas to drop it there
(`updateNodePosition`). Positions are sticky: nothing ever auto-repositions
a node once placed.

## Canvas

`src/components/Canvas.tsx` is a plain pan (drag)/zoom (wheel) transform on
a container — no 3D, no graph library. Zoom level selects one of three
detail tiers (`src/components/NodeCard.tsx`):

- **far** (`scale < 0.5`) — only `identity` nodes, as soft circles sized by
  stall count
- **mid** (`0.5–1.15`) — every node as a compact titled card
- **close** (`> 1.15`) — full card: inline-editable title/body, status,
  due-date badge, and the classification chip

Cables are SVG lines between placed endpoints; `serves` and `blocks` render
specially (green solid / red dashed), everything else falls back to a
generic dashed line — v1 only builds those two edge types via the UI (the
"link" toolbar button; shift-click the target for `blocks`), but the schema
and seed data exercise the others (`member-of`, `evidence-for`) so they're
not a schema migration away when the UI catches up.

**Solo mode**: double-click a node to collapse the canvas to its
connected lineage; Escape (or the "exit solo" button) returns.

## Stalls and "temperature"

`stall_count` and recency ("temperature" — how faded a card looks) are
**derived at read time** from the `events` table (`src/lib/queries.ts`),
never stored as columns — see the brief on why that denormalization goes
stale. A card older than 3 weeks since its last event desaturates.

## Evidence / done-log

`addEvidence` (`src/app/actions.ts`) creates an `evidence` node directly,
accepting a `created_at` in the past — completed things don't have to have
gone through capture first, and old wins can be logged retroactively rather
than starting the log at zero.

## Project structure

- `supabase/migrations/0001_init.sql` — schema + taxonomy seed
- `src/lib/types.ts` — shared TS types (mirrors the schema)
- `src/lib/taxonomy.ts` — node types / edge types / colours (also mirrored
  into the migration's `types` seed — the DB copy is what a future admin UI
  would edit at runtime; this one drives the classification prompts)
- `src/lib/classify.ts` — the two Claude API passes
- `src/lib/queries.ts` — read-side data + derived stall/heat
- `src/app/actions.ts` — every Server Action (capture, correction, edits,
  positioning, edges, evidence)
- `src/components/MapView.tsx` — top-level client state + Supabase realtime
- `scripts/seed-songs.ts` — one-off import of `seed/song_index.json`

## Explicitly not in v1

Parallax/decay animation, timeline projection, pressure view, board
(kanban) view, mixer view, multi-user. See the brief §13 for why the board
view specifically should come *after* capture+canvas are in daily use, not
before.

## Capture surfaces beyond the web app

The brief's priority order after the web app is a Telegram/WhatsApp bot
piping into the same `submitCapture` path, then a phone share-sheet
shortcut, then a desktop hotkey — none built yet. The web app's
`submitCapture` Server Action is the integration point for all of them.
