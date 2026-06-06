-- ============================================================================
--  Auto-provision a public.recruiters row when a recruiter signs up.
-- ----------------------------------------------------------------------------
--  WHY: the backend resolves RBAC by looking up auth.users.id in public.recruiters.
--  Supabase Auth creates the auth.users row on signup, but NOT our profile row.
--  This trigger bridges that gap using the user_metadata the Signup form sends
--  (`role: 'recruiter'`, `full_name`). Without it, a freshly signed-up recruiter
--  authenticates successfully but gets 403 ("no application profile") from the API.
--
--  WHEN TO RUN: paste into Supabase Dashboard → SQL Editor once, after init_db()
--  has created public.recruiters. Idempotent — safe to re-run.
--
--  NOTE: the `role` column is the SQLAlchemy-style enum whose DB label is the
--  uppercase member name, so we insert 'RECRUITER' (not 'recruiter').
-- ============================================================================

create or replace function public.handle_new_recruiter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.raw_user_meta_data ->> 'role') = 'recruiter' then
    insert into public.recruiters (id, user_id, email, full_name, role)
    values (
      gen_random_uuid(),
      new.id,
      new.email,
      new.raw_user_meta_data ->> 'full_name',
      'RECRUITER'
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_recruiter on auth.users;

create trigger on_auth_user_created_recruiter
  after insert on auth.users
  for each row
  execute function public.handle_new_recruiter();
