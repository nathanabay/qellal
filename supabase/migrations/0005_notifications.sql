-- Qellal — 0005 notification engine support (Phase 4)
-- Run after 0001–0004.

-- notifications_sent: dedup was (user, tender, channel). The reminder cadence
-- (new-digest / T-7 / T-3 / T-1) needs to dedup PER stage, so add `kind` and
-- widen the unique constraint.
alter table notifications_sent
  add column if not exists kind text not null default 'digest'
    check (kind in ('digest','reminder_7','reminder_3','reminder_1'));

alter table notifications_sent
  drop constraint if exists notifications_sent_user_id_tender_id_channel_key;
alter table notifications_sent
  drop constraint if exists notifications_sent_dedup;
alter table notifications_sent
  add constraint notifications_sent_dedup
  unique (user_id, tender_id, channel, kind);

-- profiles: secure token for one-tap Telegram linking, and a pause window.
alter table profiles
  add column if not exists telegram_link_token uuid not null default gen_random_uuid();
alter table profiles
  add column if not exists notifications_paused_until timestamptz;

-- tenders: record WHEN an item became public so the daily digest only picks up
-- genuinely new items (published_date is day-granular and set on manual entry).
alter table tenders
  add column if not exists published_at timestamptz;
-- backfill existing published rows so they aren't treated as "new" forever
update tenders set published_at = created_at
  where status = 'published' and published_at is null;

-- Denormalize email onto profiles so the notification job (which reads the public
-- schema via the service role) never needs the auth schema. Kept in sync by the
-- signup trigger below (redefined from 0002 to also copy the email).
alter table profiles add column if not exists email text;
update profiles p set email = u.email
  from auth.users u
  where u.id = p.id and p.email is distinct from u.email;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, company_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'company_name'
  );
  return new;
end;
$$;
