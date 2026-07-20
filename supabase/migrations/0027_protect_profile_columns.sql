-- 0027: stop privilege / plan self-escalation on profiles.
--
-- profiles_update_own (0003) lets a user update their OWN row, and Postgres RLS
-- cannot restrict WHICH columns — so a normal user could run
--   update profiles set role='admin'   (or plan='pro')
-- and, because every staff/admin RLS gate trusts current_user_role() (which reads
-- profiles.role), self-promote to full cross-tenant access. This is exploitable
-- today, independent of billing.
--
-- Fix at the DB level so it holds regardless of client: a BEFORE UPDATE trigger
-- that rejects changes to `role` or `plan` unless the caller is an admin or the
-- service role. Service-role writes have no JWT user (auth.uid() is null); admins
-- are identified via current_user_role(). Normal users keep updating everything
-- else on their own row.

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.plan is distinct from old.plan)
     and auth.uid() is not null
     and public.current_user_role() is distinct from 'admin' then
    raise exception 'not authorized to change role or plan';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();
