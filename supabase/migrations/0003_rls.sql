-- Qellal — 0003 Row Level Security
-- Run this THIRD (after 0001 and 0002). Enables RLS on every table + policies.
-- The service role key bypasses RLS entirely — that's how scrapers and the
-- notification job write rows. These policies govern anon + logged-in users only.

-- ---------- categories ----------
-- Public reference data (used in filters + joins). Everyone can read;
-- only the service role writes them (seed / admin). Supabase auto-enables RLS on
-- new public tables, so without this policy categories would be invisible to the app.
alter table categories enable row level security;

drop policy if exists categories_public_read on categories;
create policy categories_public_read on categories
  for select using (true);

-- ---------- tenders ----------
alter table tenders enable row level security;

-- Anyone (incl. logged-out) can read PUBLISHED tenders.
drop policy if exists tenders_public_read on tenders;
create policy tenders_public_read on tenders
  for select using (status = 'published');

-- Staff/admin can do everything (see pending_review, publish, edit, delete).
-- Permissive policies combine with OR, so this adds to the public read above.
drop policy if exists tenders_staff_all on tenders;
create policy tenders_staff_all on tenders
  for all
  using (public.current_user_role() in ('staff','admin'))
  with check (public.current_user_role() in ('staff','admin'));

-- ---------- profiles ----------
alter table profiles enable row level security;

-- Users can read and update ONLY their own profile row.
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select using (id = auth.uid());

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- subscriptions ----------
alter table subscriptions enable row level security;

-- Users have full CRUD on their OWN subscriptions only.
drop policy if exists subscriptions_own_all on subscriptions;
create policy subscriptions_own_all on subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- notifications_sent ----------
alter table notifications_sent enable row level security;

-- Users can read their own send-log; inserts happen via service role only
-- (no insert policy = authenticated users cannot insert, by design).
drop policy if exists notifications_select_own on notifications_sent;
create policy notifications_select_own on notifications_sent
  for select using (user_id = auth.uid());
