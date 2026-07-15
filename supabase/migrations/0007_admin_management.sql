-- Qellal — 0007 admin user + subscription management
-- Adds RLS so staff/admin can read all users & subscriptions, and admins can
-- update roles/plans. current_user_role() is SECURITY DEFINER, so these policies
-- checking it do NOT recurse through RLS.

-- profiles: staff/admin can read every profile (for the users table).
drop policy if exists profiles_staff_read on profiles;
create policy profiles_staff_read on profiles
  for select
  using (public.current_user_role() in ('staff', 'admin'));

-- profiles: admins can update any profile (role / plan management).
drop policy if exists profiles_admin_update on profiles;
create policy profiles_admin_update on profiles
  for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- subscriptions: staff/admin can read and delete any subscription.
drop policy if exists subscriptions_staff_all on subscriptions;
create policy subscriptions_staff_all on subscriptions
  for all
  using (public.current_user_role() in ('staff', 'admin'))
  with check (public.current_user_role() in ('staff', 'admin'));
