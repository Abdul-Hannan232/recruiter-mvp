-- ============================================================================
--  Recruiter — Supabase Row Level Security (RLS) + RBAC
-- ----------------------------------------------------------------------------
--  WHEN TO RUN: paste into Supabase Dashboard → SQL Editor AFTER the FastAPI
--  backend has booted once (init_db() creates the public tables + pgvector).
--  This script only enables RLS and defines policies on tables that already exist.
--
--  WHY IT MATTERS / SCOPE:
--    * Our FastAPI backend connects directly to Postgres as the `postgres` role,
--      which has BYPASSRLS. So NOTHING here restricts the trusted server-side
--      orchestration (Agents 1–5, HITL writes). It keeps full access.
--    * These policies are a DEFENSE-IN-DEPTH layer that governs ONLY direct
--      browser→Supabase access (supabase-js with the anon key + a logged-in user
--      via PostgREST). That is the surface where a candidate could otherwise read
--      someone else's data.
--    * `service_role` (the sb_secret_... key) also bypasses RLS by design.
--
--  Idempotent: safe to re-run. Policies are dropped + recreated.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. RBAC helper. SECURITY DEFINER so it reads `recruiters` as the function
--    owner (postgres, BYPASSRLS) — this both works regardless of the caller's
--    role AND avoids infinite RLS recursion (a policy on recruiters that calls a
--    function which itself selects from recruiters).
-- ----------------------------------------------------------------------------
create or replace function public.is_recruiter()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.recruiters r where r.user_id = auth.uid()
  );
$$;

revoke all on function public.is_recruiter() from public;
grant execute on function public.is_recruiter() to authenticated;

-- ----------------------------------------------------------------------------
-- 1. Baseline grants. RLS filters ROWS, but the role still needs table-level
--    privileges to attempt access at all. anon stays locked out entirely.
-- ----------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, update on public.candidates       to authenticated;
grant select          on public.recruiters       to authenticated;
grant select          on public.job_descriptions to authenticated;
grant select          on public.interviews       to authenticated;

-- ----------------------------------------------------------------------------
-- 2. CANDIDATES — the talent pool.
--    * A candidate may read + update ONLY the row linked to their own auth.uid().
--    * A recruiter may READ the entire pool (no write — status transitions are
--      performed server-side by the trusted backend).
-- ----------------------------------------------------------------------------
alter table public.candidates enable row level security;
-- FORCE so even the table owner is subject to policies via PostgREST. (Direct
-- postgres connections still bypass because the role has BYPASSRLS.)
alter table public.candidates force row level security;

drop policy if exists candidates_select_own        on public.candidates;
drop policy if exists candidates_update_own         on public.candidates;
drop policy if exists candidates_recruiter_read_all on public.candidates;

create policy candidates_select_own
  on public.candidates for select
  to authenticated
  using (auth.uid() = user_id);

create policy candidates_update_own
  on public.candidates for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Permissive SELECT policies are OR'd: a recruiter additionally sees every row.
create policy candidates_recruiter_read_all
  on public.candidates for select
  to authenticated
  using (public.is_recruiter());

-- ----------------------------------------------------------------------------
-- 3. RECRUITERS — each recruiter sees only their own profile row.
-- ----------------------------------------------------------------------------
alter table public.recruiters enable row level security;
alter table public.recruiters force row level security;

drop policy if exists recruiters_select_own on public.recruiters;

create policy recruiters_select_own
  on public.recruiters for select
  to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. JOB_DESCRIPTIONS — recruiter-domain. Recruiters read all; candidates none.
-- ----------------------------------------------------------------------------
alter table public.job_descriptions enable row level security;
alter table public.job_descriptions force row level security;

drop policy if exists jobs_recruiter_read_all on public.job_descriptions;

create policy jobs_recruiter_read_all
  on public.job_descriptions for select
  to authenticated
  using (public.is_recruiter());

-- ----------------------------------------------------------------------------
-- 5. INTERVIEWS — a candidate reads only their own interview; recruiters read all.
-- ----------------------------------------------------------------------------
alter table public.interviews enable row level security;
alter table public.interviews force row level security;

drop policy if exists interviews_select_own        on public.interviews;
drop policy if exists interviews_recruiter_read_all on public.interviews;

create policy interviews_select_own
  on public.interviews for select
  to authenticated
  using (
    exists (
      select 1 from public.candidates c
      where c.id = interviews.candidate_id
        and c.user_id = auth.uid()
    )
  );

create policy interviews_recruiter_read_all
  on public.interviews for select
  to authenticated
  using (public.is_recruiter());

commit;

-- ============================================================================
--  Verify (optional): list every policy you just created.
--    select tablename, policyname, cmd
--    from pg_policies where schemaname = 'public' order by tablename, policyname;
-- ============================================================================
