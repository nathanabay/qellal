-- 0016: Use 2merkato's own categories instead of the 17 super-categories.
-- Clears the taxonomy so the scraper repopulates it with real 2merkato category
-- names (created on the fly). Detach FKs first, then reset.
begin;

update public.tenders set category_id = null
where category_id in (select id from public.categories);
update public.subscriptions set category_id = null
where category_id in (select id from public.categories);

delete from public.categories;
alter sequence categories_id_seq restart with 1;

commit;
