-- Qellal — 0008 billing subscription lifecycle (Slice 2)
-- Test-mode subscription state machine. NO payment processing — transitions are
-- driven by the app now; in production they'd be driven by gateway webhooks
-- (service role). One row per user.

create table if not exists billing_subscriptions (
  user_id uuid primary key references profiles(id) on delete cascade,
  plan_id text not null default 'free' check (plan_id in ('free', 'pro')),
  status text not null default 'active'
    check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled')),
  trial_ends_at timestamptz,
  current_period_start timestamptz default now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table billing_subscriptions enable row level security;

-- Users manage their own subscription (test mode). In production, writes would
-- be locked to the service role and only reads exposed here.
drop policy if exists billing_own_all on billing_subscriptions;
create policy billing_own_all on billing_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Staff/admin can read & manage all (admin billing views).
drop policy if exists billing_staff_all on billing_subscriptions;
create policy billing_staff_all on billing_subscriptions
  for all
  using (public.current_user_role() in ('staff', 'admin'))
  with check (public.current_user_role() in ('staff', 'admin'));
