-- Adds every table to the `supabase_realtime` publication. Without this,
-- Supabase never pushes postgres_changes events to the browser client
-- (src/components/MapView.tsx), so classification results and edits made
-- from elsewhere never appear live — only the optimistic local update on
-- the machine that made the change would show anything.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nodes'
  ) then
    alter publication supabase_realtime add table nodes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'edges'
  ) then
    alter publication supabase_realtime add table edges;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    alter publication supabase_realtime add table events;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'captures'
  ) then
    alter publication supabase_realtime add table captures;
  end if;
end $$;
