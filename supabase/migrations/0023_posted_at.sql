-- 0023: precise 2merkato posting instant (date AND time). Derived by the scraper
-- from the visible "Posted X ago" label (falling back to the source created_at /
-- published_at timestamp). Distinct from:
--   published_at  — when the row became public in Qellal (drives the digest)
--   published_date/published_on — the source publication DATE (day only)
alter table public.tenders
  add column if not exists posted_at timestamptz;
