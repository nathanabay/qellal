-- 0020: Index publishing_entity to speed the entity_stats view's GROUP BY and
-- the per-entity profile lookups (.eq('publishing_entity', ...)). Partial on
-- published since every entity query filters to published tenders.
create index if not exists tenders_publishing_entity_idx
  on public.tenders (publishing_entity)
  where status = 'published';
