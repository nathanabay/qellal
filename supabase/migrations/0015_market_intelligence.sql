-- 0015: Market-intelligence aggregates over the historical archive.
-- Exposed as views so the DB does the grouping once per query (Postgres GROUP BY
-- over the archive is fast + indexed). security_invoker = on so the querying
-- role's RLS applies (anon sees published tenders only). Note: these are
-- publication-stage aggregates — Qellal has no award/winner data, so no
-- "who won / at what price".

-- Per procuring entity: how much they tender, how much is open now, recency.
create or replace view public.entity_stats
with (security_invoker = on) as
select
  publishing_entity as entity,
  count(*)::int as tender_count,
  count(*) filter (where deadline >= current_date)::int as open_count,
  max(published_date) as last_published
from public.tenders
where status = 'published'
  and publishing_entity is not null
  and btrim(publishing_entity) <> ''
group by publishing_entity;

-- Tenders published per month — seasonality.
create or replace view public.monthly_activity
with (security_invoker = on) as
select
  to_char(date_trunc('month', published_date), 'YYYY-MM') as month,
  count(*)::int as tender_count
from public.tenders
where status = 'published' and published_date is not null
group by 1;

grant select on public.entity_stats, public.monthly_activity to anon, authenticated;
