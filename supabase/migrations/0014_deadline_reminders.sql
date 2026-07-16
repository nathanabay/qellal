-- 0014: per-user toggle for staged deadline reminders (T-7 / T-3 / T-1).
-- On by default — this is the product's core promise ("never miss a deadline").
alter table public.profiles
  add column if not exists deadline_reminders boolean not null default true;
