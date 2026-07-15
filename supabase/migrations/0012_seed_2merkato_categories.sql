-- 0012: Replace the placeholder taxonomy with 2merkato's real super-categories.
-- Source: bespotender category_mapping_plan.md (169 raw 2merkato categories
-- rolled up into 17 browsable super-categories). Names trimmed for the mobile
-- filter UI. Slugs are stable (used in ?category= URLs).

begin;

-- Detach demo tenders + subscriptions from the placeholder categories.
update public.tenders set category_id = null
where category_id in (select id from public.categories);
update public.subscriptions set category_id = null
where category_id in (select id from public.categories);

delete from public.categories;
alter sequence categories_id_seq restart with 1;

insert into public.categories (name, slug) values
  ('Construction & Engineering',                 'construction-engineering'),
  ('Information Technology & Telecom',            'ict-telecom'),
  ('Medical, Health & Pharmaceuticals',          'medical-health-pharma'),
  ('Agriculture & Farming',                      'agriculture-farming'),
  ('Manufacturing, Machinery & Heavy Industry',  'manufacturing-machinery'),
  ('Vehicles, Transport & Logistics',            'vehicles-transport-logistics'),
  ('Electrical, Energy & Power',                 'electrical-energy-power'),
  ('Business, Finance & Professional Services',  'business-finance-services'),
  ('Marketing, Advertising & Events',            'marketing-advertising-events'),
  ('Office, Education & Stationery',             'office-education-stationery'),
  ('Household, Furniture & Furnishings',         'household-furniture-furnishings'),
  ('Clothing, Textiles & Personal Care',         'clothing-textiles-personal-care'),
  ('Hospitality, Food & Beverages',              'hospitality-food-beverages'),
  ('Real Estate, Facilities & Maintenance',      'real-estate-facilities-maintenance'),
  ('Raw Materials, Chemicals & Metals',          'raw-materials-chemicals-metals'),
  ('Sales, Disposals & Privatization',           'sales-disposals-privatization'),
  ('General Services & Miscellaneous',           'general-services-misc');

commit;
