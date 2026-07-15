# Code Patterns — Qellal

## Server vs Client Components (the #1 Next.js confusion)
- **Default = server component.** Pages that *display* data (listings, tender detail) fetch directly on the server → smaller JS bundle → faster on 3G.
- **`'use client'` only when needed:** clicks, forms, typing, useState/useEffect (filters UI, preference toggles, admin forms).
- Pattern: server page fetches data → passes props to small client components for interactivity.

## Supabase Query Patterns
```ts
// Filtered, paginated public listings (server component)
let query = supabase
  .from("tenders")
  .select("id,title,region,deadline,source_name,categories(name)")
  .eq("status", "published")
  .order("published_date", { ascending: false })
  .range(page * 20, page * 20 + 19);          // always paginate

if (category) query = query.eq("category_id", category);
if (region)   query = query.eq("region", region);
if (q)        query = query.ilike("title", `%${q}%`);  // or full-text search later
```
- Filters come from **URL query params** (`/tenders?category=3&region=addis&q=road`) so results are shareable and back-button friendly.
- Select only needed columns; never `select("*")` on list pages.

## RLS Discipline
- If a query returns empty unexpectedly, suspect RLS first — check policies before changing code.
- Never "fix" by using the service role key in the browser. Service role key lives ONLY in server code and scrapers.
- Test every new policy twice: as anonymous, and as a normal logged-in user.

## Access Check (payments-ready, month 6)
```ts
// lib/access.ts — the ONLY gate. Month 6 = extend this, nothing else.
export function canAccess(profile: { plan: string }, feature: string): boolean {
  return true; // free period: everyone gets everything
}
```
Call `canAccess()` at any gateable feature now, even though it returns true — flipping to paid later becomes a one-file change.

## Notification Matching Job (hourly)
1. Fetch tenders `published` since last successful run
2. For each, find matching subscriptions: category match OR keyword `ilike` title, AND region match if subscription has one
3. Skip pairs already in `notifications_sent` (the unique constraint is the safety net)
4. Send: Telegram `sendMessage` per user (instant users), queue email digests (digest users get one daily email)
5. Insert into `notifications_sent` — insert BEFORE counting success; failures retried next run

Idempotency rule: running the job twice must never double-send. The DB unique constraint guarantees it.

## Telegram Connect Flow
1. Preferences page shows button linking to `https://t.me/<bot>?start=<user_id>`
2. Bot webhook receives `/start <user_id>` → save `chat_id` to that profile → confirm message
3. `/stop` command clears `telegram_notifications`

## Scraper Pattern (Python)
```python
# scrapers/scrape_<source>.py — parse, normalize, push to REVIEW QUEUE
item = {
    "title": title.strip(),
    "deadline": normalized_date,      # normalize dates defensively
    "source_name": "Source X",
    "source_url": url,                 # attribution is a legal requirement
    "status": "pending_review",       # NEVER 'published' from a scraper
    "created_by": "scraper",
}
# POST to Supabase REST with service role key from env
```
- Fail loudly: raise on parse errors so GitHub Actions emails the builder.
- Skip duplicates by checking existing `source_url` before insert.

## UI Rules
- Mobile-first: style for 375px, then add `md:`/`lg:` variants
- Deadline badges on every tender surface; red when ≤3 days
- Every list has loading, empty ("No tenders match — try removing a filter"), and error states
- No heavy libraries: no moment.js (use `Intl`), no lodash, no UI kit beyond Tailwind
