-- Qellal — 0010 payments (Slice 4, Chapa)
-- Tracks payment attempts. Card data / money movement stays with Chapa; we only
-- store our own reference (tx_ref) + status. SANDBOX/test mode.

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  tx_ref text not null unique,
  provider text not null default 'chapa',
  plan_id text not null default 'pro',
  amount numeric(10, 2) not null,
  currency text not null default 'ETB',
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  created_at timestamptz default now(),
  paid_at timestamptz
);

alter table payments enable row level security;

-- Users create/read their own payment attempts (checkout + return verification).
-- The webhook uses the service role (bypasses RLS).
drop policy if exists payments_own_all on payments;
create policy payments_own_all on payments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists payments_staff_all on payments;
create policy payments_staff_all on payments
  for all
  using (public.current_user_role() in ('staff', 'admin'))
  with check (public.current_user_role() in ('staff', 'admin'));
