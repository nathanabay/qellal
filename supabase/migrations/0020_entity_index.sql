-- 0020: Index publishing_entity for entity_stats GROUP BY + profile lookups.
create index if not exists tenders_publishing_entity_idx
  on public.tenders (publishing_entity)
  where status = 'published';
