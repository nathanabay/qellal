# Technical Design Document: Qellal MVP

## Overview

This document explains HOW to build Qellal — an Ethiopian tender aggregation platform with notifications — using an approach that balances speed, $0 budget, and learning opportunities for a full-time builder with JS/Python basics and AI-tool experience.

---

## Recommended Approach

### Best Path for You: Low-Code with AI Assistance

**Primary Approach: Next.js + Supabase + Python scrapers, built with AI pair-programming**
- **Why this works:** Uses what you already know (JS basics → Next.js, Python → scrapers), the tools AI assistants know best, and one integrated backend that eliminates 80% of backend coding
- **Time to MVP:** 6–8 weeks full-time
- **Learning curve:** Moderate — first 2 weeks are the hardest
- **Cost:** $0/month on free tiers during the free period

### Tech Stack Decision (with alternatives)

#### Frontend Framework
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Next.js + Tailwind CSS** ✅ | Massive docs/community; AI assistants know it best; server-side rendering = SEO for tender pages + fast first load on slow connections; one-click Vercel deploy | Some concepts (server vs. client components) confuse beginners at first | **Recommended** |
| React + Vite (SPA) | Simpler mental model | Weak SEO (tender pages won't rank on Google — bad for growth); slower first load on 3G | Skip |
| SvelteKit | Elegant, fast | Smaller community; AI-generated code quality is noticeably worse | Skip |

**SEO matters here:** people Google tender titles. Server-rendered Next.js pages get indexed; a plain SPA mostly doesn't.

#### Backend + Database
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Supabase** ✅ | PostgreSQL (real SQL you can learn), built-in auth with password reset, row-level security, auto-generated APIs, dashboard doubles as a basic data viewer, generous free tier | Free-tier project pauses after ~1 week of inactivity (fine while building daily); no African region — use Frankfurt/EU | **Recommended** |
| Firebase | Very mature, good docs | NoSQL makes search/filtering (your core feature) harder; vendor lock-in; harder to add complex queries later | Skip |
| PocketBase (self-hosted) | One tiny binary, full control | You'd manage hosting/backups yourself — not worth it as a learner on a deadline | Skip |

#### Scrapers
- **Python + `requests` + `BeautifulSoup`** — you know some Python; these are the most-documented scraping libraries on earth
- **Scheduler: GitHub Actions cron** (free ~2,000 minutes/month) runs scrapers every few hours and inserts results into Supabase via its REST API — **into a review queue, never straight to public**
- Alternative: Supabase Edge Functions (TypeScript) — fine later, but Python is your faster path now

#### Notifications
- **Telegram Bot API** — completely free, unlimited, and Telegram is huge in Ethiopia. This is your workhorse channel.
- **Email: Resend (or Brevo)** — free tiers exist but are limited (Resend has been ~100 emails/day free; Brevo ~300/day — verify current limits). **Daily digest mode is not optional — it's how you stay inside free email limits.**
- **Matching job:** a scheduled function runs hourly: find tenders published since last run → match against user category/keyword subscriptions → queue and send alerts. Meets the PRD's "within 1 hour" criterion.

#### Hosting
- **Vercel free tier** — Git push = deployed; global CDN edge nodes reduce latency for Ethiopian users even though compute sits in EU/US
- Backup option: Netlify or Cloudflare Pages (similar model)

#### Ethiopia latency reality check
No major free-tier provider has servers in Africa. Mitigations that matter more than server location:
1. Server-rendered, lightweight pages (minimal JS shipped)
2. Vercel's CDN caches static assets near users
3. Pick **EU (Frankfurt)** region for Supabase — closest to Ethiopia
4. Compress images, system fonts, no heavy libraries — the PRD's "<3s on 3G/4G" is achievable

---

## Project Structure

```
qellal/
├── app/                     # Next.js App Router (pages)
│   ├── page.tsx             # Home / listings (public)
│   ├── tenders/[id]/        # Tender detail page
│   ├── login/  signup/      # Auth pages
│   ├── preferences/         # Notification preferences
│   └── admin/               # Admin panel (protected)
├── components/              # Reusable UI (TenderCard, Filters...)
├── lib/
│   ├── supabase.ts          # Supabase client
│   └── matching.ts          # Tender↔subscription matching logic
├── scrapers/                # Python scrapers (separate world)
│   ├── scrape_portal_x.py
│   └── push_to_supabase.py
├── .github/workflows/       # Cron jobs (scrapers, notifications)
├── .env.local               # Secret keys (never commit!)
└── package.json
```

**Why this structure:** standard patterns AI assistants recognize instantly; scrapers isolated so a broken scraper can never break the website.

---

## Data Model (Supabase / PostgreSQL)

```sql
-- Tenders (the core entity)
tenders: id, title, description, category_id, region, publishing_entity,
         published_date, deadline, source_name, source_url,
         status ('pending_review' | 'published' | 'rejected'),
         created_by ('scraper' | user_id), created_at

-- Categories (fixed list: construction, IT, supplies, consultancy...)
categories: id, name, slug

-- Profiles (extends Supabase auth.users)
profiles: id (= auth user id), full_name, company_name,
          role ('user' | 'staff' | 'admin'),
          plan ('free')            -- ← month-6 payments hook: add 'paid' later
          telegram_chat_id, email_notifications (bool),
          telegram_notifications (bool), digest_mode (bool)

-- Subscriptions (what each user wants alerts for)
subscriptions: id, user_id, category_id (nullable), keyword (nullable), region (nullable)

-- Notification log (dedup + debugging + CTR metric)
notifications_sent: id, user_id, tender_id, channel, sent_at
```

**Row Level Security (RLS):** published tenders readable by everyone; pending ones only by staff/admin; users can only edit their own profile/subscriptions. Supabase enforces this at the database level — a security win you get almost for free.

**Month-6 payments readiness:** the `plan` field + one access-check function (`canAccess(user, feature)`) is all the scaffolding you need now. Chapa/Telebirr integration later just flips `plan` after a successful payment webhook. No rewrite.

---

## Building Each Feature

### Feature 1: Tender Listings + Search/Filtering
**Complexity:** Easy-Medium — this is classic CRUD, ideal first feature
1. Create tables in Supabase dashboard (visual, no code)
2. Build listings page: server component fetches published tenders, renders cards with deadline badges
3. Filters = URL query params (`?category=construction&region=addis`) → Supabase query with `.eq()` / `.ilike()` filters
4. Postgres full-text search for keywords (built into Supabase)
- **Test by:** seeding 20 fake tenders, filtering on mobile
- **Learning points:** SQL basics, server components, URL state

### Feature 2: User Accounts & Preferences
**Complexity:** Easy with Supabase Auth
1. Supabase Auth handles signup/login/password reset out of the box
2. On signup, a database trigger creates the `profiles` row
3. Preferences page: pick categories, add keywords, toggle channels
- **Test by:** full signup → reset password → edit preferences loop
- **Learning points:** auth flows, protected routes, RLS

### Feature 3: Notifications (the differentiator)
**Complexity:** Medium — the most custom logic in the project
1. **Telegram connect flow:** user taps "Connect Telegram" → opens `t.me/QellalBot?start=<their_user_id>` → bot receives `/start <user_id>` → saves `telegram_chat_id` to their profile. One tap, meets the PRD criterion.
2. **Matching job (hourly, GitHub Actions or Supabase cron):** new published tenders → match against subscriptions (category OR keyword-in-title, and region if set) → check `notifications_sent` to avoid duplicates → send
3. **Sending:** Telegram = one HTTPS call per message (free); email via Resend/Brevo API, defaulting users to daily digest
4. **Unsubscribe:** one-click link in every email; `/stop` command in the bot
- **Test by:** subscribe to "construction" → publish a matching tender via admin → alert arrives within the hour
- **Learning points:** cron jobs, webhooks, API calls, idempotency (the dedup log)

### Feature 4: Admin Panel
**Complexity:** Easy-Medium
1. Route group `/admin` protected by role check (staff/admin only)
2. Add-tender form, review queue (approve/reject scraped items), listings table with edit/delete
3. Approving a tender flips `status` to `published` — which is what the matching job watches
- **Test by:** staff account publishes a tender in under 3 minutes
- **Learning points:** role-based access, forms, moderation workflow

### Feature 5: Scrapers
**Complexity:** Medium — and inherently fragile, hence the review queue
1. One Python script per source; start with the 1–2 highest-volume sources only
2. Parse title/deadline/entity → insert via Supabase REST API. Trusted sources (2merkato) insert with `status='published'` directly; the `pending_review` review queue is used for manual admin entries. (Original plan routed all scrapes through review; superseded 2026-07-20.)
3. GitHub Actions runs them every 4–6 hours; failures alert you (email from Actions)
4. **Legality guardrail:** store source attribution + link on every tender; scrape only public notices; respect robots.txt; confirm Ethiopian legal position during the free period (open question from your PRD)
- **Test by:** run locally, verify items land in the review queue with correct fields
- **Learning points:** HTML parsing, APIs, scheduled jobs

---

## Build Order (6–8 Weeks, Full-Time)

### Week 1: Foundation
- [ ] Set up accounts: GitHub, Vercel, Supabase (EU region), Resend/Brevo, Telegram bot via @BotFather
- [ ] Next.js project deployed to Vercel ("Hello Qellal" live on day 2)
- [ ] Database tables + RLS created; seed fake tenders

### Weeks 2–3: Public Core
- [ ] Listings page with cards + deadline badges (mobile-first)
- [ ] Search + filters
- [ ] Tender detail page
- [ ] Auth (signup/login/reset)

### Week 4: Preferences + Admin
- [ ] Notification preferences screen
- [ ] Admin panel: add tender, review queue, edit/delete, roles

### Week 5: Notifications
- [ ] Telegram bot + connect flow
- [ ] Matching job + email digest
- [ ] Dedup log + unsubscribe paths

### Week 6: Scrapers + Polish
- [ ] First 1–2 scrapers running on schedule
- [ ] Error handling, empty states, loading states
- [ ] Performance pass (test on throttled 3G in Chrome DevTools)

### Weeks 7–8: Beta + Launch
- [ ] Analytics (signups, subscription rate, notification CTR)
- [ ] Privacy policy & terms; SEO basics (metadata, sitemap)
- [ ] Beta with 5–10 real businesses → fix → launch

---

## AI Assistance Strategy

**Primary tool: Claude Code** (or Cursor — you've tried it) for building; keep a chat assistant open for explanations.

| Task | Tool | Example prompt |
|------|------|----------------|
| Schema & architecture | Claude (chat) | "Review this Supabase schema for a tender platform — what's missing?" |
| Building features | Claude Code / Cursor | "Build the listings page per the spec below…" |
| Scrapers | Claude Code (Python) | "Write a BeautifulSoup scraper for this HTML structure: [paste]" |
| Debugging | Any | "Error: [msg]. Code: [paste]. Explain the cause, then fix." |
| Understanding | Claude (chat) | "Explain this code line by line for a beginner" |

### Prompt templates for your mix preference ("AI builds, explains the tricky parts")
```
Build [feature] for my Next.js + Supabase tender platform.
Requirements: [paste from PRD]
Constraints: mobile-first, lightweight pages, free tier only.
Write the code, then briefly explain the 2–3 non-obvious decisions you made.
```
```
This works but I don't fully get it: [paste code]
Explain: 1) how [specific part] works, 2) whether it's the right approach, 3) what concept I should learn next.
```

---

## Cost Breakdown

> **Verify all pricing/limits on vendor pages before relying on them — free tiers change.** Last sanity-checked: mid-2026.

### Free period ($0/month) — limits you might hit
| Service | Free tier (approx — verify) | Risk for Qellal |
|---------|------------------------------|-----------------|
| Vercel | ~100GB bandwidth/mo | Low at 1,000 users with light pages |
| Supabase | ~500MB DB, 50K monthly auth users; pauses after ~1wk inactivity | 5,000 listings ≈ a few MB — low risk; inactivity pause is a non-issue while building daily |
| Resend / Brevo | ~100/day / ~300/day emails | **Highest risk** → digest mode default; push users toward Telegram |
| Telegram Bot API | Unlimited, free | None 🎉 |
| GitHub Actions | ~2,000 min/mo | Low — scrapers are minutes/day |

### After free period (month 6+, rough monthly)
- Supabase Pro ~$25 · Vercel Pro ~$20 (only if limits hit) · Email ~$15–20 · SMS gateway (if added) — get quotes from Ethiopian providers · Chapa/Telebirr per-transaction fees — confirm current rates with both providers
- **Realistic total: ~$40–70/month + payment fees** — easily covered by a modest number of subscribers

---

## Common Challenges & Solutions

**"Supabase RLS is blocking my queries"** — the #1 beginner Supabase issue. Ask AI: "Here's my RLS policy and the failing query — why is it blocked?" Almost always a missing policy.

**"The scraper broke"** — expected, not a crisis. The review queue + manual entry means the site never shows bad data. Fix the parser with AI when it happens.

**"Next.js server vs. client components confuse me"** — rule of thumb: pages that *show* data = server components; anything with clicks/typing/state = client (`'use client'`). Ask AI which one every time until it's intuitive.

**"Emails going to spam"** — set up domain verification (SPF/DKIM) in your email provider from day one; it's a 15-minute DNS task.

---

## Learning Resources (prioritized for your path)

**Week 1:** Next.js official tutorial (nextjs.org/learn) — do the first half; Supabase quickstart for Next.js (supabase.com/docs)
**Week 2:** Supabase Auth + RLS guides; Tailwind docs as-needed (don't study it — look things up)
**Week 5:** Telegram Bot API docs (core.telegram.org/bots) — just the `sendMessage` + webhook basics
**When stuck:** Supabase Discord and Next.js Discord are both active and beginner-friendly

---

## Important Limitations (honest trade-offs)

1. **No African hosting region** → mitigated by CDN + lightweight pages, but Addis users will see ~200–300ms API latency. Acceptable for this app type (not real-time).
2. **Free email tiers are tight** → Telegram-first strategy + digests. If email demand explodes, that's a good problem (~$15–20/mo fixes it).
3. **Scrapers are brittle** → review queue + staff manual entry is your real reliability layer; scrapers are an accelerant, not the foundation.
4. **Supabase free tier pauses on inactivity** → irrelevant while building/launched with daily traffic; upgrade at month 6 anyway.
5. **You'll write TypeScript with training wheels** → let AI handle types early; understanding deepens by week 3–4.

---

## Definition of Technical Success

- [ ] Deployed and accessible on a real domain
- [ ] All 5 PRD features work end-to-end: browse → sign up → subscribe → receive alert → open tender
- [ ] Pages load <3s on throttled 3G
- [ ] You can add a small feature yourself with AI help
- [ ] $0/month spend confirmed on all dashboards
- [ ] Adding payments at month 6 requires only: Chapa/Telebirr webhook + flipping the `plan` field

---
*Created for: Qellal*
*Your Path: Low-code with AI assistance (balanced learning)*
*Estimated Time: 6–8 weeks full-time*
*Estimated Cost: $0/month free period → ~$40–70/month after*
