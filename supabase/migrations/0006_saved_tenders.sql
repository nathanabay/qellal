-- Qellal — 0006 saved tenders (F10 bookmarks/shortlist)
-- Scope note: bookmarks were originally post-MVP; promoted into scope on 2026-07-15.

create table if not exists saved_tenders (
  user_id uuid not null references profiles(id) on delete cascade,
  tender_id uuid not null references tenders(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, tender_id)   -- one save per user/tender
);

alter table saved_tenders enable row level security;

-- Users can only see and manage their own saves.
drop policy if exists saved_own_all on saved_tenders;
create policy saved_own_all on saved_tenders
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
