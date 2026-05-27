-- OpenMRS AI Agent — generation history
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  requirement text not null,
  model text,
  test_cases jsonb not null default '[]'::jsonb,
  synthetic_data jsonb not null default '{}'::jsonb,
  automation_skeleton jsonb not null default '{}'::jsonb,
  coverage jsonb,
  safety jsonb,
  created_at timestamptz not null default now()
);

create index if not exists generations_user_id_created_at_idx
  on public.generations (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Already created the table? Run the statements below (or supabase/migrations/
-- 002_add_missing_columns.sql) to add columns added after the first release.
-- ---------------------------------------------------------------------------

alter table public.generations
  add column if not exists model text;

alter table public.generations
  add column if not exists coverage jsonb;

alter table public.generations
  add column if not exists safety jsonb;

-- Server-side API routes use the service_role key + Clerk userId filtering.
-- Disable RLS so inserts are not blocked (see migrations/003_disable_rls.sql).
alter table public.generations disable row level security;
