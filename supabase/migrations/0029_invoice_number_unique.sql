-- 0029: invoice numbers must be unique.
--
-- generateInvoice() builds `number` from a date + a short random suffix with no
-- DB guard, so two invoices could share a human-facing number (an accounting
-- correctness bug). Enforce uniqueness at the DB level; the app widens the
-- suffix and retries on conflict. (Assumes no existing duplicates — true in the
-- pre-launch/test dataset.)
create unique index if not exists invoices_number_key on public.invoices (number);
