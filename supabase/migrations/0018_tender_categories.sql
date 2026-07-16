-- 0018: A tender can belong to MANY 2merkato categories. Join table holds them
-- all; tenders.category_id stays as the primary (first) one for simple filters.
create table if not exists public.tender_categories (
  tender_id uuid not null references public.tenders(id) on delete cascade,
  category_id int not null references public.categories(id) on delete cascade,
  primary key (tender_id, category_id)
);
create index if not exists tender_categories_category_idx
  on public.tender_categories (category_id);

alter table public.tender_categories enable row level security;

-- Anyone may read the categories of a published tender.
drop policy if exists tender_categories_read on public.tender_categories;
create policy tender_categories_read on public.tender_categories
  for select using (
    exists (
      select 1 from public.tenders t
      where t.id = tender_id and t.status = 'published'
    )
  );

grant select on public.tender_categories to anon, authenticated;
