-- 0025: guarantee that a published tender always has published_at set.
--
-- published_at (added in 0005) is the "became public in Qellal" instant that
-- drives the daily digest window in scripts/notify.py. The scraper sets it on
-- insert, but the admin review->publish path (publishTender) only set
-- published_date, leaving published_at null — so manually reviewed tenders were
-- silently excluded from every digest. Rather than patch one call site, enforce
-- the invariant in the database so ALL publish paths (admin, scraper, future)
-- are covered: whenever a row is published without a published_at, stamp now().
-- Existing non-null values (e.g. the scraper's own timestamp) are preserved.

create or replace function public.set_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists tenders_set_published_at on public.tenders;
create trigger tenders_set_published_at
  before insert or update on public.tenders
  for each row execute function public.set_published_at();

-- Backfill already-published rows that predate this trigger. Use created_at
-- (guaranteed non-null) as in 0005; these rows are far outside the digest
-- freshness window, so backfilling cannot retro-trigger a flood of alerts.
update public.tenders
  set published_at = created_at
  where status = 'published' and published_at is null;
