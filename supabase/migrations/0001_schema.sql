-- Qellal — 0001 schema
-- Run this FIRST in the Supabase SQL editor (Project → SQL Editor → New query).
-- Creates the 5 core tables + indexes. No RLS yet (see 0003).

-- Categories: fixed taxonomy for tenders (construction, ICT, medical, ...)
create table if not exists categories (
  id serial primary key,
  name text not null,
  slug text unique not null
);

-- Tenders: the core entity. Deadline-forward (always required); source attribution is legal.
create table if not exists tenders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category_id int references categories(id),
  region text,
  publishing_entity text,
  published_date date,
  deadline date not null,                     -- always required
  source_name text not null,                  -- attribution always
  source_url text,
  status text not null default 'pending_review'
    check (status in ('pending_review','published','rejected')),
  created_by text not null default 'scraper',
  created_at timestamptz default now()
);
create index if not exists tenders_status_pubdate_idx on tenders (status, published_date desc);
create index if not exists tenders_deadline_idx on tenders (deadline);

-- Profiles: 1:1 with auth.users. `plan` is the month-6 payments hook.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  role text not null default 'user' check (role in ('user','staff','admin')),
  plan text not null default 'free',
  telegram_chat_id text,
  email_notifications boolean default true,
  telegram_notifications boolean default false,
  digest_mode boolean default true,           -- protects the free email tier
  created_at timestamptz default now()
);

-- Subscriptions: a user's alert rules (by category / keyword / region).
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  category_id int references categories(id),
  keyword text,
  region text,
  created_at timestamptz default now()
);

-- Notifications sent: dedup log. The unique constraint guarantees no double-sends.
create table if not exists notifications_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  tender_id uuid not null references tenders(id) on delete cascade,
  channel text not null check (channel in ('email','telegram')),
  sent_at timestamptz default now(),
  unique (user_id, tender_id, channel)
);
