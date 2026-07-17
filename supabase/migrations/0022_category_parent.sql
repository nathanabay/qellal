-- 0022: store 2merkato's category hierarchy explicitly. parent_id links each
-- child category to its parent (null for a top-level category). The scraper
-- syncs this and `position` from 2merkato's /api/v1/categories on every run, so
-- the taxonomy (parents, children, and order) stays identical to 2merkato after
-- scraping instead of drifting as new categories are created ad hoc.
alter table public.categories
  add column if not exists parent_id int
    references public.categories(id) on delete set null;

create index if not exists categories_parent_idx
  on public.categories (parent_id);
