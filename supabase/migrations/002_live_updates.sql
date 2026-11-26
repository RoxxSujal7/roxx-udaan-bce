-- UDAAN 2026: Live match board + on-site live announcements
-- Run this in Supabase SQL Editor. Idempotent; does not touch event_registrations.

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  title text,
  stage text,
  team_a text,
  team_b text,
  venue text not null,
  starts_at timestamptz not null,
  status text not null default 'upcoming'
    check (status in ('upcoming','live','finished','postponed','cancelled')),
  score_a text,
  score_b text,
  result text,
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint matches_text_len check (
    char_length(event) <= 40 and char_length(coalesce(title,'')) <= 80 and
    char_length(coalesce(stage,'')) <= 40 and char_length(coalesce(team_a,'')) <= 80 and
    char_length(coalesce(team_b,'')) <= 80 and char_length(venue) <= 80 and
    char_length(coalesce(score_a,'')) <= 60 and char_length(coalesce(score_b,'')) <= 60 and
    char_length(coalesce(result,'')) <= 160
  )
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) between 3 and 280),
  level text not null default 'info' check (level in ('info','important','urgent')),
  link text check (link is null or link ~ '^(/|\./|\.\./)[A-Za-z0-9_./#?=&-]*$'),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_matches_starts_at on public.matches (starts_at);
create index if not exists idx_announcements_created_at on public.announcements (created_at desc);

-- Auto-update updated_at on matches
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_matches_touch on public.matches;
create trigger trg_matches_touch
  before update on public.matches
  for each row execute function public.touch_updated_at();

alter table public.matches enable row level security;
alter table public.announcements enable row level security;

-- Public READ only. Filtering of hidden / inactive / expired rows happens client-side
-- so Realtime UPDATE events that hide or deactivate a row still reach clients.
drop policy if exists "public read matches" on public.matches;
create policy "public read matches" on public.matches
  for select to anon, authenticated using (true);

drop policy if exists "public read announcements" on public.announcements;
create policy "public read announcements" on public.announcements
  for select to anon, authenticated using (true);

-- Realtime: full replica identity + idempotent publication registration
alter table public.matches replica identity full;
alter table public.announcements replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
end
$$;
