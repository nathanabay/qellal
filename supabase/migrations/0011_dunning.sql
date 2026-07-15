-- Qellal — 0011 dunning / overdue management (Slice 5)
-- Tracks the collections lifecycle when a renewal charge fails.

alter table billing_subscriptions
  add column if not exists past_due_since timestamptz;
alter table billing_subscriptions
  add column if not exists dunning_attempt int not null default 0;
