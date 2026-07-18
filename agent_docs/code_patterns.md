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

## Notification Matching Job (`scripts/notify.py`, daily cron)
Runs once a day via `.github/workflows/notify.yml`. Stdlib Python only — no deps.
It sends two things:
- **Digest** of newly-published matching tenders. Cadence per user: `digest_frequency`
  `off` / `daily` (24h window) / `weekly` (7-day window, Mondays). Uses `tenders.published_at`
  for the freshness window (a published tender with no `published_at` is invisible to the
  digest — the `set_published_at` trigger guarantees it's always set).
- **Deadline reminders** at T-7 / T-3 / T-1 (`kind` = `reminder_7|3|1`). Catch-up-safe:
  a tender maps to the tightest stage it has *reached* (`days_left <= threshold`), so a
  skipped run or a late-scraped tender still gets nudged instead of falling between marks.

**Matching semantics** (`matches()` / `user_matches()`):
- Within one subscription, **every set criterion must match (AND)** — category AND region
  AND keyword. A subscription with category=Construction + region=Addis matches only
  Construction tenders in Addis.
- Across a user's subscriptions, **any match wins (OR)**.
- Keyword matching expands through sector synonym clusters (word-boundary regex over
  title + buyer + description), so "IT" also catches "service desk".

**Idempotency** — running the job twice must never double-send:
1. Dedup key is `(user_id, tender_id, channel, kind)` in `notifications_sent`; the job pre-filters
   against it, and the DB unique constraint is the ultimate guard.
2. **Claim before send**: insert the `notifications_sent` row *before* sending; if the send
   fails, delete it (rollback) so the message retries next run. A duplicate is impossible;
   a failed send is not lost.

**Email** is text + HTML (`multipart/alternative`) over SMTP, with a one-click unsubscribe
link in the footer and `List-Unsubscribe` / `List-Unsubscribe-Post` headers (RFC 8058).
**Deliverability (DNS, do before launch):** publish SPF and DKIM records for the sending
domain and a DMARC policy — required by Gmail/Yahoo bulk-sender rules; without them alerts
land in spam and the notification promise silently breaks. `SMTP_FROM` must be on that domain.

## Telegram Connect Flow
1. Account page links to `https://t.me/<bot>?start=<profiles.telegram_link_token>` (a secret
   per-user uuid, not the user id — avoids leaking/guessing account ids).
2. Bot webhook (`/api/telegram/webhook`) receives `/start <token>`, matches the token, and sets
   `telegram_chat_id` + `telegram_notifications=true`. Requests are verified with
   `TELEGRAM_WEBHOOK_SECRET`.
3. `/stop` clears `telegram_notifications` and `telegram_chat_id`.

## Scraper Pattern (TypeScript)
Scrapers live in `scrapers/src/sources/<source>.ts` and upsert via
`scrapers/src/lib/upsert.ts` with the service-role key. One source per file.
```ts
// normalize, dedup by source_url, then insert
const row = {
  title: title.trim(),
  deadline: normalizedDate,        // normalize dates defensively
  source_name: "2merkato",
  source_url: url,                 // attribution is a legal requirement
  status: "published",             // ⚠️ see note below
  created_by: "scraper",
  published_at: nowIso,            // set on publish so the digest can see it
};
```
- Fail loudly: throw on parse errors so the GitHub Actions run fails and notifies.
- Skip duplicates by checking existing `source_url` before insert.
- ⚠️ **Auto-publish divergence:** `upsert.ts` currently inserts scraped tenders as
  `status='published'` (2merkato is treated as a trusted source; only manual admin
  entries go to `pending_review`). This contradicts the `AGENTS.md` hard rule that
  scrapers write `pending_review` only — tracked as an open decision in `MEMORY.md`.
  It also matters for notifications: only `published` tenders with a `published_at`
  reach the digest.

## UI Rules
- Mobile-first: style for 375px, then add `md:`/`lg:` variants
- Deadline badges on every tender surface; red when ≤3 days
- Every list has loading, empty ("No tenders match — try removing a filter"), and error states
- No heavy libraries: no moment.js (use `Intl`), no lodash, no UI kit beyond Tailwind
