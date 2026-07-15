-- 0013: Extra bid facts scraped from 2merkato detail pages.
-- Stored as text: 2merkato returns amounts as numbers or free-text ("N/A",
-- "5% of bid price"), and published_on is a formatted source date string.
alter table public.tenders
  add column if not exists bid_bond text,
  add column if not exists bid_document_price text,
  add column if not exists published_on text;
