-- 0021: new-tender digest frequency (report §6.3 — let users pick cadence).
-- Replaces the boolean digest_mode with a three-way choice:
--   'daily'  — one digest per day of the last 24h of matches (previous default)
--   'weekly' — one digest each Monday covering the last 7 days
--   'off'    — no new-tender digest (deadline reminders still send)
-- digest_mode is kept in sync (frequency <> 'off') so any legacy reader is safe.

alter table public.profiles
  add column if not exists digest_frequency text not null default 'daily'
    check (digest_frequency in ('off', 'daily', 'weekly'));

-- Backfill from the existing toggle: unchecked digest → 'off'.
update public.profiles
  set digest_frequency = case when digest_mode then 'daily' else 'off' end;
