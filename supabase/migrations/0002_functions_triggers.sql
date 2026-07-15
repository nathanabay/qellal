-- Qellal — 0002 functions & triggers
-- Run this SECOND. These are needed by the RLS policies in 0003.

-- Returns the role ('user'|'staff'|'admin') of the currently authenticated user.
-- SECURITY DEFINER so it can read `profiles` without being blocked by RLS —
-- this is what lets RLS policies check "is this caller staff?" WITHOUT recursion.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Auto-create a profile row whenever a new auth user signs up.
-- Without this, a signed-up user would have no profile and all their
-- profile/subscription RLS checks would fail. SECURITY DEFINER bypasses RLS on insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company_name)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'company_name'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
