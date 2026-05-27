-- Run this in Supabase SQL Editor if you already created `generations` before
-- the `model`, `coverage`, and `safety` columns were added.
--
-- Safe to run multiple times (uses IF NOT EXISTS).

alter table public.generations
  add column if not exists model text;

alter table public.generations
  add column if not exists coverage jsonb;

alter table public.generations
  add column if not exists safety jsonb;

-- Ensure jsonb defaults exist on older tables
alter table public.generations
  alter column test_cases set default '[]'::jsonb;

alter table public.generations
  alter column synthetic_data set default '{}'::jsonb;

alter table public.generations
  alter column automation_skeleton set default '{}'::jsonb;

create index if not exists generations_user_id_created_at_idx
  on public.generations (user_id, created_at desc);
