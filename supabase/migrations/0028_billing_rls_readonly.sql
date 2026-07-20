-- 0028: lock billing writes to the service role (real-money posture).
--
-- 0008/0009/0010 shipped the billing tables with `for all` own-row policies
-- ("test mode"), which let any authenticated user write their own billing state
-- directly with the anon key — e.g.
--   update billing_subscriptions set plan_id='pro', status='active';
--   insert into payments (..., status:'success');
--   insert into invoices  (..., status:'paid');
-- i.e. self-grant Pro / forge paid records with no payment. Replace each owner
-- `for all` policy with owner-read-only (`for select`). Writes now happen only
-- via the service role (webhook / return handler / lifecycle server actions,
-- which bypass RLS) or staff/admin (the untouched *_staff_all policies).

-- billing_subscriptions
drop policy if exists billing_own_all on billing_subscriptions;
drop policy if exists billing_own_read on billing_subscriptions;
create policy billing_own_read on billing_subscriptions
  for select using (user_id = auth.uid());

-- payments
drop policy if exists payments_own_all on payments;
drop policy if exists payments_own_read on payments;
create policy payments_own_read on payments
  for select using (user_id = auth.uid());

-- invoices
drop policy if exists invoices_own_all on invoices;
drop policy if exists invoices_own_read on invoices;
create policy invoices_own_read on invoices
  for select using (user_id = auth.uid());

-- invoice_lines
drop policy if exists invoice_lines_own_all on invoice_lines;
drop policy if exists invoice_lines_own_read on invoice_lines;
create policy invoice_lines_own_read on invoice_lines
  for select using (
    exists (select 1 from invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );
