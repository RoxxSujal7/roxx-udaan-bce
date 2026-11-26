-- UDAAN 2026 Event Registration Schema
-- Run in Supabase SQL Editor or via `supabase db push`.

create extension if not exists pgcrypto;

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  full_name text not null,
  email text not null,
  phone text not null,
  college text not null,
  roll_number text,
  department text,
  academic_year text,
  events jsonb not null check (jsonb_typeof(events) = 'array' and jsonb_array_length(events) >= 1),
  participation_type text not null default 'individual' check (participation_type in ('individual', 'team')),
  team_name text,
  team_members text,
  notes text,
  confirmed_details boolean not null default false check (confirmed_details = true),
  status text not null default 'submitted',
  created_at timestamptz not null default now()
);

create index if not exists idx_event_registrations_created_at
  on public.event_registrations (created_at desc);

alter table public.event_registrations enable row level security;

-- No anon or authenticated SELECT, INSERT, UPDATE, or DELETE policies.
-- Registrations are written exclusively server-side by the Cloudflare Pages Function
-- using the Supabase secret key.
