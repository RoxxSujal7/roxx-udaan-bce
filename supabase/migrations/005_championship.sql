-- UDAAN 2026: Championship standings, podiums & knockout brackets
-- Depends on 002_live_updates.sql and 004_scorecard.sql. Idempotent.

create table if not exists public.event_types (
  event text primary key,
  event_type text not null check (event_type in ('team','individual')),
  counts_for text not null default 'udaan' check (counts_for in ('udaan','ignition'))
);

insert into public.event_types (event, event_type, counts_for) values
  ('Cricket','team','udaan'),
  ('Football','team','udaan'),
  ('Volleyball','team','udaan'),
  ('Kabaddi','team','udaan'),
  ('Tug of War','team','udaan'),
  ('Badminton','individual','udaan'),
  ('Table Tennis','individual','udaan'),
  ('Athletics','individual','udaan'),
  ('Board Games','individual','udaan'),
  ('Javelin','individual','udaan'),
  ('Literary','individual','udaan'),
  ('Cultural','team','udaan'),
  ('BGMI','team','ignition'),
  ('Free Fire','team','ignition'),
  ('Valorant','team','ignition')
on conflict (event) do nothing;

create table if not exists public.points_rules (
  event_type text not null check (event_type in ('team','individual')),
  place smallint not null check (place between 1 and 3),
  points integer not null check (points >= 0),
  primary key (event_type, place)
);

insert into public.points_rules (event_type, place, points) values
  ('team', 1, 10),
  ('team', 2, 6),
  ('team', 3, 3),
  ('individual', 1, 5),
  ('individual', 2, 3),
  ('individual', 3, 1)
on conflict do nothing;

create table if not exists public.podiums (
  id uuid primary key default gen_random_uuid(),
  event text not null references public.event_types(event),
  place smallint not null check (place between 1 and 3),
  department text not null check (department in ('CSE','ECE','EE','ME','CE','Other')),
  team_id uuid references public.teams(id) on delete set null,
  label text check (label is null or char_length(label) <= 80),
  awarded_at timestamptz not null default now(),
  unique (event, place, department)
);

create index if not exists idx_podiums_awarded_at on public.podiums (awarded_at desc);

drop view if exists public.championship_standings;
create or replace view public.championship_standings with (security_invoker = true) as
select
  p.department,
  et.counts_for,
  sum(r.points)::integer as points,
  count(*) filter (where p.place = 1)::integer as gold,
  count(*) filter (where p.place = 2)::integer as silver,
  count(*) filter (where p.place = 3)::integer as bronze
from public.podiums p
join public.event_types et on et.event = p.event
join public.points_rules r on r.event_type = et.event_type and r.place = p.place
group by p.department, et.counts_for;

create table if not exists public.brackets (
  event text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.event_types enable row level security;
alter table public.points_rules enable row level security;
alter table public.podiums enable row level security;
alter table public.brackets enable row level security;

drop policy if exists "public read event_types" on public.event_types;
create policy "public read event_types" on public.event_types
  for select to anon, authenticated using (true);

drop policy if exists "public read points_rules" on public.points_rules;
create policy "public read points_rules" on public.points_rules
  for select to anon, authenticated using (true);

drop policy if exists "public read podiums" on public.podiums;
create policy "public read podiums" on public.podiums
  for select to anon, authenticated using (true);

drop policy if exists "public read brackets" on public.brackets;
create policy "public read brackets" on public.brackets
  for select to anon, authenticated using (true);

grant select on public.championship_standings to anon, authenticated;

alter table public.podiums replica identity full;
alter table public.brackets replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'podiums'
  ) then
    alter publication supabase_realtime add table public.podiums;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'brackets'
  ) then
    alter publication supabase_realtime add table public.brackets;
  end if;
end
$$;
