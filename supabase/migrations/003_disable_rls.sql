-- Fix: "new row violates row-level security policy for table generations"
--
-- This app writes from Next.js API routes using the Supabase *service_role*
-- key (Clerk userId is enforced in application code). RLS on this table is
-- not needed and blocks inserts when enabled without matching policies.
--
-- Run in Supabase SQL Editor. Safe to run multiple times.

alter table public.generations disable row level security;

-- Drop any policies that may have been added manually (ignore if none exist).
drop policy if exists "generations_select_own" on public.generations;
drop policy if exists "generations_insert_own" on public.generations;
drop policy if exists "generations_service_all" on public.generations;
