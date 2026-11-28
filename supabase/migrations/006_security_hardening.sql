-- UDAAN 2026: Security hardening migration (Fix 2, Fix 4, Fix 5)
-- Idempotent; preserves all existing data and views.

-- Fix 4: Add FOR UPDATE row locking to record_match_result
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
    where id = p_match_id
    for update;

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

-- Fix 2: Ensure team_standings only aggregates matches belonging to the team's event
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
  and m.event = t.event
  and (m.team_a_id = t.id or m.team_b_id = t.id)
group by t.id;

grant select on public.team_standings to anon, authenticated;

-- Fix 2: Transactional team update that guards event changes on linked matches and syncs denormalized names
create or replace function public.update_team_and_sync(
  p_team_id uuid,
  p_event text default null,
  p_name text default null,
  p_department text default null,
  p_group_label text default null,
  p_clear_group boolean default false
)
returns setof public.teams language plpgsql as $$
declare
  v_old_event text;
  v_old_name text;
begin
  select event, name
    into v_old_event, v_old_name
    from public.teams
    where id = p_team_id
    for update;

  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  if p_event is not null and p_event <> v_old_event then
    if exists (
      select 1 from public.matches
      where team_a_id = p_team_id or team_b_id = p_team_id
    ) then
      raise exception 'TEAM_HAS_MATCHES';
    end if;
  end if;

  update public.teams
     set event = coalesce(p_event, event),
         name = coalesce(p_name, name),
         department = coalesce(p_department, department),
         group_label = case
           when p_clear_group then null
           when p_group_label is not null then p_group_label
           else group_label
         end
   where id = p_team_id;

  if p_name is not null and p_name <> v_old_name then
    update public.matches
       set team_a = p_name
     where team_a_id = p_team_id;

    update public.matches
       set team_b = p_name
     where team_b_id = p_team_id;
  end if;

  return query
    select * from public.teams where id = p_team_id;
end $$;

revoke execute on function public.update_team_and_sync(uuid, text, text, text, text, boolean) from public, anon, authenticated;

-- Fix 5: Reject protocol-relative '//' announcement links at the DB constraint layer
alter table public.announcements
  drop constraint if exists announcements_link_check;

alter table public.announcements
  drop constraint if exists announcements_link_relative_check;

alter table public.announcements
  add constraint announcements_link_relative_check
  check (
    link is null
    or (
      link ~ '^(/|\./|\.\./)[A-Za-z0-9_./#?=&-]*$'
      and link !~ '^//'
    )
  );
