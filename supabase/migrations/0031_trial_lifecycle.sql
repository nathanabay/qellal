-- 0031: trial lifecycle correctness.
--
-- Problem (found in audit): a `trialing` subscription granted Pro forever.
--   * The 0030 sync trigger mapped ANY trialing row to plan='pro', ignoring
--     trial_ends_at, and nothing re-evaluated the row once time passed.
--   * A user could loop Start trial -> Cancel -> Start trial for unlimited Pro.
-- Latent today only because access.ts FREE_PERIOD disables gating; it would let
-- every user self-grant permanent free Pro the moment billing goes live.
--
-- Fixes here:
--   (1) Harden sync_profile_plan(): a trialing sub is Pro only while its trial
--       window is still open (trial_ends_at in the future).
--   (2) Add trial_started_at so a used trial is remembered across cancel — the
--       app refuses a second trial (see account/plan-actions.ts).
-- The time-based expiry itself is driven by a daily job that flips elapsed
-- trials to 'canceled' (api/cron/expire-trials); the update fires this trigger
-- and re-syncs profiles.plan back to 'free'.

alter table billing_subscriptions
  add column if not exists trial_started_at timestamptz;

-- Existing trialing rows have already consumed their one trial.
update billing_subscriptions
  set trial_started_at = coalesce(trial_started_at, current_period_start, created_at)
  where status = 'trialing' and trial_started_at is null;

create or replace function public.sync_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set plan = case
      when new.status = 'active' then new.plan_id
      -- Trials only count while the window is open; an elapsed trial is Free.
      when new.status = 'trialing'
        and new.trial_ends_at is not null
        and new.trial_ends_at > now()
        then new.plan_id
      else 'free'
    end
    where id = new.user_id;
  return new;
end;
$$;

-- Re-sync existing rows once so any already-elapsed trial drops to Free now
-- (a no-op UPDATE fires the AFTER trigger above).
update billing_subscriptions set updated_at = updated_at;
