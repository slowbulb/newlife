-- Life-map schema. Deliberately thin (one `nodes` table with a `type`
-- column, not a table per type) because the taxonomy will churn — see
-- README.md and the build brief for why.

create extension if not exists pgcrypto;

create table if not exists types (
  key text primary key,
  label text not null,
  terminal_form text,
  colour text,
  notes text
);

create table if not exists nodes (
  id uuid primary key default gen_random_uuid(),
  type text not null references types(key),
  title text not null,
  body text,
  status text,
  terminal_form text,
  owner text,
  external_holder text,
  due_date date,
  irreversible boolean not null default false,
  cost_money numeric,
  cost_hours numeric,
  cost_exposure text,
  domain text,
  lane text,
  x double precision,
  y double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_touched_at timestamptz not null default now()
);

create table if not exists edges (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references nodes(id) on delete cascade,
  to_id uuid not null references nodes(id) on delete cascade,
  type text not null,
  undecided boolean not null default false,
  created_at timestamptz not null default now()
);

-- The important one: stall_count and "temperature" (recency/heat) are
-- DERIVED from this at read time. Never store them as columns on `nodes` —
-- that's exactly the kind of denormalization that goes stale.
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references nodes(id) on delete cascade,
  kind text not null check (kind in ('created','started','abandoned','completed','revised','touched')),
  at timestamptz not null default now(),
  note text
);

create table if not exists captures (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null,
  created_at timestamptz not null default now(),
  node_id uuid references nodes(id) on delete set null,
  classification_json jsonb,
  corrected boolean not null default false
);

create index if not exists nodes_domain_idx on nodes(domain);
create index if not exists nodes_type_idx on nodes(type);
create index if not exists nodes_status_idx on nodes(status);
create index if not exists edges_from_idx on edges(from_id);
create index if not exists edges_to_idx on edges(to_id);
create index if not exists events_node_idx on events(node_id);
create index if not exists events_node_at_idx on events(node_id, at desc);
create index if not exists captures_node_idx on captures(node_id);
create index if not exists captures_unclassified_idx on captures(created_at) where node_id is null;

insert into types (key, label, terminal_form, colour, notes) values
 ('identity','Identity',null,'#f5c518','Root node — the kind of person you want to be'),
 ('value','Value',null,'#f5c518',null),
 ('goal','Goal',null,'#e0a72e','Decomposes into projects/actions'),
 ('project','Project',null,'#e0a72e','Has stages, multiple children'),
 ('action','Action','action','#4caf7d','Done once, ticked'),
 ('habit','Habit','repetition','#38a3a5','Cadence + streak, never done'),
 ('anti-habit','Anti-habit','repetition','#38a3a5','A habit you want rid of'),
 ('skill','Skill',null,'#3a86ff','Decomposes into a practice ladder + a repetition — never a checklist'),
 ('acquisition','Acquisition','action','#4caf7d','Something to buy or get'),
 ('bottleneck','Bottleneck',null,'#e63946','External — in the way'),
 ('resistance','Resistance',null,'#e63946','Internal — in the way'),
 ('question','Question','understanding','#8338ec',null),
 ('decision','Decision','decision','#ff6b6b','Resolves by choosing, not doing'),
 ('experiment','Experiment','action','#4caf7d',null),
 ('ritual','Ritual','repetition','#38a3a5',null),
 ('constraint','Constraint',null,'#6c757d','Never actionable, always relevant'),
 ('resource','Resource',null,'#6c757d',null),
 ('person','Person',null,'#adb5bd',null),
 ('spark','Spark',null,'#ffb703','Non-actionable idea worth keeping'),
 ('evidence','Evidence',null,'#2ec4b6','Logged wins, attaches upward to the identity it served'),
 ('sidelined','Sidelined',null,'#495057','Parked, not abandoned'),
 ('unsorted','Unsorted',null,'#343a40','A legitimate permanent resting state, not an error')
on conflict (key) do nothing;

-- Row Level Security: this is a single-user personal tool with no logged-in
-- sessions in v1. RLS stays on and grants the anon key full access rather
-- than turning it off outright, so a future move to real auth is a policy
-- change, not a schema change. DO NOT deploy this publicly reachable —
-- the anon key can read and write everything. See README "Security" section.
alter table types enable row level security;
alter table nodes enable row level security;
alter table edges enable row level security;
alter table events enable row level security;
alter table captures enable row level security;

drop policy if exists "anon full access" on types;
create policy "anon full access" on types for all using (true) with check (true);
drop policy if exists "anon full access" on nodes;
create policy "anon full access" on nodes for all using (true) with check (true);
drop policy if exists "anon full access" on edges;
create policy "anon full access" on edges for all using (true) with check (true);
drop policy if exists "anon full access" on events;
create policy "anon full access" on events for all using (true) with check (true);
drop policy if exists "anon full access" on captures;
create policy "anon full access" on captures for all using (true) with check (true);
