# MEMORY.md — Living State for Qellal

> The agent updates this file as work progresses. Keep entries short. This file is the source of truth for "where are we?"

## 🏗️ Active Phase & Goal

**Phase 1 — Foundation (Week 1)**
Goal: Next.js project deployed to Vercel ("Hello Qellal" live), Supabase project created in EU/Frankfurt with all tables + RLS policies, 20 seed tenders inserted.

Next 3 tasks:
1. [ ] Initialize Next.js + TypeScript + Tailwind repo; push to GitHub; connect Vercel
2. [ ] Create Supabase project (EU region); create tables per `agent_docs/tech_stack.md` schema; enable RLS
3. [ ] Seed categories + 20 fake tenders; render raw list on homepage to prove the pipe works

## 📌 Key Decisions Log

| Date | Decision | Why |
|------|----------|-----|
| 2026-07-15 | Next.js + Supabase + Python scrapers | Beginner-friendly, AI-familiar, $0 tier, SEO for tender pages |
| 2026-07-15 | Telegram-first notifications, email digest default | Telegram free/unlimited; free email tiers are tight |
| 2026-07-15 | Scrapers write to review queue only | Data quality; scrapers are brittle by nature |
| 2026-07-15 | Payments deferred to month 6; only `plan` field + `canAccess()` now | Avoid rewrite later without building it now |

## ✅ Done Log

*(append verified, committed slices here — one line each)*

- 2026-07-15 — Agent setup files created (AGENTS.md, agent_docs/, CLAUDE.md)

## ⚠️ Open Issues / Blockers

- Legal position on republishing tender notices in Ethiopia — confirm during free period; attribution always on
- Signup target (300/30 days) is a placeholder — builder to confirm
- Verify current free-tier limits: Resend/Brevo daily email cap, Supabase pause policy
