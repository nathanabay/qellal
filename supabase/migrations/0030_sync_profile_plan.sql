-- 0030: make billing_subscriptions the single source of truth for a user's plan.
--
-- profiles.plan was written independently by the admin Users page and by the
-- billing lifecycle, so the two could drift ("is this user Pro?" had two
-- answers). Derive profiles.plan from billing_subscriptions via a trigger: it is
-- 'pro' only while the subscription is active/trialing, else 'free'. SECURITY
-- DEFINER so the sync applies even when an admin edits another user's row (it
-- must bypass RLS on profiles); the 0027 guard still authorizes the caller.
create or replace function public.sync_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set plan = case
      when new.status in ('active', 'trialing') then new.plan_id
      else 'free'
    end
    where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists sync_profile_plan on public.billing_subscriptions;
create trigger sync_profile_plan
  after insert or update on public.billing_subscriptions
  for each row execute function public.sync_profile_plan();
