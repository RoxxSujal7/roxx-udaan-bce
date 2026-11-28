// UDAAN 2026: Admin login rate limiting & lockout (idempotent).
// Tracks failed login attempts by salted SHA-256 IP hash; accessible only via service_role.

create table if not exists public.admin_login_attempts (
  ip_hash text primary key,
  fail_count integer not null default 0,
  first_failed_at timestamptz,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.admin_login_attempts enable row level security;

revoke all on table public.admin_login_attempts from public, anon, authenticated;

-- Atomically records a failed admin login attempt within a 15-minute window
-- and sets a 15-minute lockout once fail_count reaches 5.
create or replace function public.record_admin_login_failure(
  p_ip_hash text
)
returns table (
  fail_count integer,
  locked_until timestamptz
)
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_window interval := interval '15 minutes';
begin
  return query
  insert into public.admin_login_attempts as a (
    ip_hash,
    fail_count,
    first_failed_at,
    locked_until,
    updated_at
  )
  values (p_ip_hash, 1, v_now, null, v_now)
  on conflict (ip_hash) do update
    set fail_count = case
          when a.first_failed_at is null
            or a.first_failed_at < v_now - v_window
            or (a.locked_until is not null and a.locked_until <= v_now)
          then 1
          else a.fail_count + 1
        end,
        first_failed_at = case
          when a.first_failed_at is null
            or a.first_failed_at < v_now - v_window
            or (a.locked_until is not null and a.locked_until <= v_now)
          then v_now
          else a.first_failed_at
        end,
        locked_until = case
          when a.first_failed_at is null
            or a.first_failed_at < v_now - v_window
            or (a.locked_until is not null and a.locked_until <= v_now)
          then null
          when a.fail_count + 1 >= 5
          then v_now + v_window
          else a.locked_until
        end,
        updated_at = v_now
  returning a.fail_count, a.locked_until;
end $$;

revoke execute on function public.record_admin_login_failure(text) from public, anon, authenticated;
