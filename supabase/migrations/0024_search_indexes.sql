-- 0024: make free-text search scale. A leading-wildcard ILIKE '%q%' can't use a
-- btree index, so search does a sequential scan over every published tender —
-- fine at a few thousand rows, linear as the archive grows. Trigram GIN indexes
-- let Postgres use an index for the title/buyer ILIKE. (Description is left
-- unindexed: a trgm GIN over long bodies is large and rarely the deciding field.)
create extension if not exists pg_trgm;

create index if not exists tenders_title_trgm
  on public.tenders using gin (title gin_trgm_ops);

create index if not exists tenders_entity_trgm
  on public.tenders using gin (publishing_entity gin_trgm_ops);
