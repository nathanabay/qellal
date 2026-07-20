# MEMORY.md — Living State for Qellal

> The agent updates this file as work progresses. Keep entries short. This file is the source of truth for "where are we?"

## 🏗️ Active Phase & Goal

**Phase: Hardening & polish** (core build, Phases 1–5, is largely shipped — see Done Log)
Goal: reliability + correctness pass on shipped systems, notifications first (audit in progress), then performance / SEO / launch prep.

Next tasks:
1. [ ] Land the notification-system audit fixes (published_at, catch-up reminders, one-click unsubscribe, GET pagination, claim-before-send idempotency, matcher tests, HTML email)
2. [ ] Resolve the two policy conflicts in Open Issues (scraper auto-publish; notification cadence vs. the "<1 hr" goal)
3. [ ] End-to-end golden path: browse → sign up → subscribe → alert arrives → open tender

## 📌 Key Decisions Log

| Date | Decision | Why |
|------|----------|-----|
| 2026-07-15 | Next.js + Supabase + Python scrapers | Beginner-friendly, AI-familiar, $0 tier, SEO for tender pages |
| 2026-07-15 | Telegram-first notifications, email digest default | Telegram free/unlimited; free email tiers are tight |
| 2026-07-15 | Scrapers write to review queue only | Data quality; scrapers are brittle by nature |
| 2026-07-15 | Payments deferred to month 6; only `plan` field + `canAccess()` now | Avoid rewrite later without building it now |
| 2026-07-18 | Scrapers ship in **TypeScript** (`scrapers/src`), not Python | Share types/utils with the app; Node runtime on Actions |
| 2026-07-18 | Email sends via **SMTP** (stdlib `notify.py`), not a Resend/Brevo SDK | Zero-dependency job; any SMTP provider works |
| 2026-07-18 | 2merkato scraper **auto-publishes**; manual admin entries are reviewed | 2merkato is a curated source — but conflicts with the review-queue rule; see Open Issues |

## ✅ Done Log

*(append verified, committed slices here — one line each)*

- 2026-07-18 — Done Log reconstructed from shipped code (file was stale at Phase 1). Shipped: schema + RLS (migrations `0001`–`0026`), auth (signup/login/reset), public listings + MeiliSearch, tender detail, account + notification prefs, admin review queue + publish + roles, Telegram connect + daily `notify.py` job (digest + T-7/3/1 reminders), 2merkato scraper (TS), billing/invoices/dunning, market-intelligence insights.
- 2026-07-18 — Notification-system audit + fixes (published_at trigger, catch-up reminders, one-click email unsubscribe, GET pagination, claim-before-send, HTML email, `scripts/test_notify.py`).

## ⚠️ Open Issues / Blockers

- ⚠️ **Scraper auto-publish vs. review-queue hard rule:** `scrapers/src/lib/upsert.ts` inserts 2merkato tenders as `status='published'`, but `AGENTS.md` (hard rules) and `code_patterns.md` say scrapers must write `pending_review` only. Decide: bless auto-publish for trusted sources (update the rule) OR route scrapes through review.
- ⚠️ **Notification cadence vs. "<1 hr" goal:** `notify.py` runs once daily (`0 5 * * *`), but `AGENTS.md` Phase 4 and the PRD promise alerts <1 hr after publish. Daily digest is the free-tier-friendly design; hourly instant alerts raise email volume/cost. Decide before launch.
- Legal position on republishing tender notices in Ethiopia — confirm during free period; attribution always on
- Signup target (300/30 days) is a placeholder — builder to confirm
- Verify current free-tier limits: SMTP provider daily email cap, Supabase pause policy
