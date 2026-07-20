-- 0032: indexes for the hot tender filter/sort paths.
--
-- Existing: (status, published_date desc), (deadline), (publishing_entity).
-- Missing (found in audit) — these currently sequential-scan on the Postgres
-- fallback and the homepage open-count as the archive grows:
--   * status + deadline together — powers getOpenTenderCount() (runs on every
--     homepage, cached 1h) and deadline-sorted listing.
--   * category_id / region filters on the Postgres fallback browser. Partial
--     (WHERE status='published') keeps them small — that's the only status the
--     public ever queries.

create index if not exists tenders_status_deadline_idx
  on public.tenders (status, deadline);

create index if not exists tenders_pub_category_idx
  on public.tenders (category_id)
  where status = 'published';

create index if not exists tenders_pub_region_idx
  on public.tenders (region)
  where status = 'published';
