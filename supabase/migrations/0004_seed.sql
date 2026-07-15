-- Qellal — 0004 seed data (DEV ONLY)
-- Run this LAST (after 0001–0003). Safe to re-run: it clears prior seed rows first.
-- These are FAKE tenders for local development. created_by='seed' marks them so we
-- can wipe them without touching real scraped/published data later.
--
-- Deadlines are relative to the day you run this (current_date + N days) so the
-- "days left" badges always look right, including a few red (<=3 days) ones.

-- ---------- categories ----------
insert into categories (name, slug) values
  ('Construction & Civil Works', 'construction'),
  ('ICT & Telecom',              'ict'),
  ('Medical & Pharmaceutical',   'medical'),
  ('Consultancy Services',       'consultancy'),
  ('Supply of Goods',            'goods'),
  ('Agriculture',                'agriculture'),
  ('Transport & Logistics',      'transport'),
  ('Energy & Water',             'energy'),
  ('Education & Training',        'education'),
  ('Financial Services',          'finance')
on conflict (slug) do nothing;

-- ---------- tenders ----------
delete from tenders where created_by = 'seed';

insert into tenders
  (title, description, category_id, region, publishing_entity, published_date, deadline, source_name, source_url, status, created_by)
values
  ('Construction of 45km Asphalt Road — Adama to Awash Section',
   'Design and build of a 45km two-lane asphalt road including three bridges and drainage works.',
   (select id from categories where slug='construction'), 'Oromia', 'Ethiopian Roads Administration',
   current_date - 2, current_date + 2, 'Ethiopian Roads Administration', 'https://era.gov.et/tenders/seed-001', 'published', 'seed'),

  ('Supply and Installation of Fibre Optic Network Equipment',
   'Procurement of DWDM equipment and installation across 12 regional data centres.',
   (select id from categories where slug='ict'), 'Addis Ababa', 'Ethio Telecom',
   current_date - 1, current_date + 3, 'Ethio Telecom', 'https://ethiotelecom.et/tenders/seed-002', 'published', 'seed'),

  ('Procurement of Essential Medicines — Framework Agreement',
   'Two-year framework for supply of essential medicines to public hospitals nationwide.',
   (select id from categories where slug='medical'), 'Addis Ababa', 'Ethiopian Pharmaceuticals Supply Service',
   current_date - 3, current_date + 3, 'EPSS', 'https://epss.gov.et/tenders/seed-003', 'published', 'seed'),

  ('Consultancy for Feasibility Study — Bahir Dar Industrial Park',
   'Feasibility study and master plan for a 150-hectare industrial park.',
   (select id from categories where slug='consultancy'), 'Amhara', 'Industrial Parks Development Corporation',
   current_date - 4, current_date + 7, 'IPDC', 'https://ipdc.gov.et/tenders/seed-004', 'published', 'seed'),

  ('Supply of 200 Desktop Computers and Peripherals',
   'Delivery of 200 desktop computers, monitors, and UPS units to regional offices.',
   (select id from categories where slug='goods'), 'Sidama', 'Sidama Regional Government',
   current_date - 2, current_date + 5, 'Sidama Region Procurement', 'https://example.gov.et/tenders/seed-005', 'published', 'seed'),

  ('Supply of Improved Wheat Seed — 5,000 Quintals',
   'Procurement and distribution of certified improved wheat seed to cooperatives.',
   (select id from categories where slug='agriculture'), 'Amhara', 'Ministry of Agriculture',
   current_date - 5, current_date + 10, 'Ministry of Agriculture', 'https://moa.gov.et/tenders/seed-006', 'published', 'seed'),

  ('Freight Transport Services — Djibouti to Modjo Dry Port',
   'One-year contract for container haulage between Djibouti port and Modjo dry port.',
   (select id from categories where slug='transport'), 'Oromia', 'Ethiopian Shipping & Logistics',
   current_date - 1, current_date + 14, 'ESL', 'https://esl.gov.et/tenders/seed-007', 'published', 'seed'),

  ('EPC Contract — 50MW Solar Power Plant, Metehara',
   'Engineering, procurement and construction of a 50MW grid-connected solar plant.',
   (select id from categories where slug='energy'), 'Oromia', 'Ethiopian Electric Power',
   current_date - 6, current_date + 21, 'Ethiopian Electric Power', 'https://eep.gov.et/tenders/seed-008', 'published', 'seed'),

  ('Printing and Supply of Grade 9 Textbooks',
   'Printing, binding and delivery of 1.2 million secondary-school textbooks.',
   (select id from categories where slug='education'), 'Addis Ababa', 'Ministry of Education',
   current_date - 3, current_date + 12, 'Ministry of Education', 'https://moe.gov.et/tenders/seed-009', 'published', 'seed'),

  ('Core Banking System Upgrade — Consultancy & Implementation',
   'Selection of a vendor to upgrade the core banking platform and migrate data.',
   (select id from categories where slug='finance'), 'Addis Ababa', 'Commercial Bank of Ethiopia',
   current_date - 2, current_date + 30, 'Commercial Bank of Ethiopia', 'https://cbe.com.et/tenders/seed-010', 'published', 'seed'),

  ('Construction of 8-Classroom Block — Mekelle',
   'Building of an eight-classroom block with sanitation facilities.',
   (select id from categories where slug='construction'), 'Tigray', 'Tigray Education Bureau',
   current_date - 4, current_date + 9, 'Tigray Education Bureau', 'https://example.gov.et/tenders/seed-011', 'published', 'seed'),

  ('Supply of Laboratory Reagents and Consumables',
   'Annual supply of diagnostic reagents to regional referral hospitals.',
   (select id from categories where slug='medical'), 'Dire Dawa', 'Dire Dawa Health Bureau',
   current_date - 1, current_date + 6, 'Dire Dawa Health Bureau', 'https://example.gov.et/tenders/seed-012', 'published', 'seed'),

  ('Managed Cloud Hosting and Cybersecurity Services',
   'Two-year managed hosting and 24/7 security monitoring for government services.',
   (select id from categories where slug='ict'), 'Addis Ababa', 'Information Network Security Administration',
   current_date - 7, current_date + 18, 'INSA', 'https://insa.gov.et/tenders/seed-013', 'published', 'seed'),

  ('Supply and Delivery of 30 Ambulances',
   'Procurement of 30 fully-equipped ambulances for regional health facilities.',
   (select id from categories where slug='goods'), 'Amhara', 'Amhara Health Bureau',
   current_date - 2, current_date + 25, 'Amhara Health Bureau', 'https://example.gov.et/tenders/seed-014', 'published', 'seed'),

  ('Drilling of 12 Deep Water Boreholes',
   'Drilling, casing and pump installation for 12 community water supply boreholes.',
   (select id from categories where slug='energy'), 'Somali', 'Somali Region Water Bureau',
   current_date - 3, current_date + 15, 'Somali Region Water Bureau', 'https://example.gov.et/tenders/seed-015', 'published', 'seed'),

  ('Audit Services — Public Enterprises Portfolio 2018 EFY',
   'External audit of a portfolio of state-owned enterprises for the fiscal year.',
   (select id from categories where slug='consultancy'), 'Addis Ababa', 'Office of the Federal Auditor General',
   current_date - 5, current_date + 20, 'OFAG', 'https://ofag.gov.et/tenders/seed-016', 'published', 'seed'),

  ('Supply of Fertiliser (Urea & NPS) — 20,000 Tonnes',
   'Import and inland delivery of blended fertiliser ahead of the planting season.',
   (select id from categories where slug='agriculture'), 'Oromia', 'Ethiopian Agricultural Businesses Corporation',
   current_date - 1, current_date + 4, 'EABC', 'https://example.gov.et/tenders/seed-017', 'published', 'seed'),

  ('City Bus Fleet Maintenance Contract',
   'Three-year preventive and corrective maintenance for a 300-bus fleet.',
   (select id from categories where slug='transport'), 'Addis Ababa', 'Anbessa City Bus Service Enterprise',
   current_date - 6, current_date + 28, 'Anbessa City Bus', 'https://example.gov.et/tenders/seed-018', 'published', 'seed'),

  ('Teacher Training Programme — Digital Pedagogy',
   'Design and delivery of a blended training programme for 5,000 teachers.',
   (select id from categories where slug='education'), 'SNNPR', 'SNNPR Education Bureau',
   current_date - 2, current_date + 11, 'SNNPR Education Bureau', 'https://example.gov.et/tenders/seed-019', 'published', 'seed'),

  ('Micro-Insurance Product Design Consultancy',
   'Actuarial and product-design consultancy for a rural micro-insurance scheme.',
   (select id from categories where slug='finance'), 'Addis Ababa', 'National Bank of Ethiopia',
   current_date - 4, current_date + 45, 'National Bank of Ethiopia', 'https://nbe.gov.et/tenders/seed-020', 'published', 'seed');
