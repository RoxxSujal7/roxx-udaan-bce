-- UDAAN 2026: Live scorecard, previous results & standings (no draws)
-- Standings/result logic adapted from dino-kupinic/tourney (MIT License).
-- Depends only on 002_live_updates.sql. Idempotent; does not touch event_registrations.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  name text not null check (char_length(name) between 1 and 80),
  department text not null check (department in ('CSE','ECE','EE','ME','CE','Other')),
  group_label text check (group_label is null or char_length(group_label) <= 20),
  created_at timestamptz not null default now(),
  unique (event, name)
);

alter table public.matches
  add column if not exists team_a_id uuid references public.teams(id) on delete set null,
  add column if not exists team_b_id uuid references public.teams(id) on delete set null,
  add column if not exists group_label text,
  add column if not exists round text not null default 'league' check (round in ('league','QF','SF','3P','F')),
  add column if not exists points_a integer check (points_a is null or points_a >= 0),
  add column if not exists points_b integer check (points_b is null or points_b >= 0),
  add column if not exists winner_id uuid references public.teams(id) on delete set null;

create index if not exists idx_teams_event on public.teams (event);
create index if not exists idx_matches_team_a_id on public.matches (team_a_id);
create index if not exists idx_matches_team_b_id on public.matches (team_b_id);

-- Drop views before recreating in case column list changed
drop view if exists public.team_standings;
create or replace view public.team_standings with (security_invoker = true) as
select
  t.id as team_id,
  t.name as team_name,
  t.department,
  t.event,
  t.group_label,
  count(m.id) as played,
  count(m.id) filter (where m.winner_id = t.id) as wins,
  count(m.id) filter (where m.winner_id is not null and m.winner_id <> t.id) as losses,
  coalesce(sum(case when m.team_a_id = t.id then m.points_a else m.points_b end), 0) as scored,
  coalesce(sum(case when m.team_a_id = t.id then m.points_b else m.points_a end), 0) as conceded,
  coalesce(sum(case when m.team_a_id = t.id then m.points_a - m.points_b else m.points_b - m.points_a end), 0) as difference,
  3 * count(m.id) filter (where m.winner_id = t.id) as points
from public.teams t
left join public.matches m
  on m.status = 'finished'
  and m.hidden = false
  and m.round = 'league'
  and (m.team_a_id = t.id or m.team_b_id = t.id)
group by t.id;

drop view if exists public.team_history;
create or replace view public.team_history with (security_invoker = true) as
select
  t.id as team_id,
  m.id as match_id,
  m.event,
  m.round,
  m.stage,
  m.starts_at,
  m.venue,
  case when m.team_a_id = t.id then m.team_b else m.team_a end as opponent,
  case when m.team_a_id = t.id then coalesce(m.points_a::text, m.score_a) else coalesce(m.points_b::text, m.score_b) end as own_score,
  case when m.team_a_id = t.id then coalesce(m.points_b::text, m.score_b) else coalesce(m.points_a::text, m.score_a) end as opp_score,
  case when m.winner_id = t.id then 'W' else 'L' end as outcome,
  m.result
from public.teams t
join public.matches m
  on (m.team_a_id = t.id or m.team_b_id = t.id)
  and m.status = 'finished'
  and m.hidden = false;

-- Called only by the admin API (secret key). NOT callable by anon/authenticated.
create or replace function public.record_match_result(
  p_match_id uuid,
  p_points_a integer,
  p_points_b integer,
  p_result text,
  p_winner_id uuid default null
)
returns void language plpgsql as $$
declare
  v_team_a uuid;
  v_team_b uuid;
  v_winner uuid;
begin
  select team_a_id, team_b_id
    into v_team_a, v_team_b
    from public.matches
    where id = p_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if p_points_a is not null and p_points_b is not null and p_points_a <> p_points_b then
    v_winner := case when p_points_a > p_points_b then v_team_a else v_team_b end;
  else
    v_winner := p_winner_id;
  end if;

  if v_winner is null or ((v_team_a is null or v_winner <> v_team_a) and (v_team_b is null or v_winner <> v_team_b)) then
    raise exception 'A valid winner_id (team_a_id or team_b_id) is required';
  end if;

  update public.matches
     set points_a = p_points_a,
         points_b = p_points_b,
         winner_id = v_winner,
         result = nullif(left(coalesce(p_result, ''), 160), ''),
         status = 'finished'
   where id = p_match_id;
end $$;

revoke execute on function public.record_match_result(uuid, integer, integer, text, uuid) from public, anon, authenticated;

alter table public.teams enable row level security;
drop policy if exists "public read teams" on public.teams;
create policy "public read teams" on public.teams
  for select to anon, authenticated using (true);

grant select on public.team_standings, public.team_history to anon, authenticated;

alter table public.teams replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams'
  ) then
    alter publication supabase_realtime add table public.teams;
  end if;
end
$$;
