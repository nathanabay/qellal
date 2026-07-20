# AGENTS.md — Master Plan for Qellal MVP

> **Read this file first in every session.** Then check `MEMORY.md` for the active phase, and `agent_docs/` for details. Do not load all docs at once — pull in only what the current task needs.

## Project Context

**Product:** Qellal — Ethiopian tender opportunity aggregation platform (mobile-first responsive web app, PWA-ready)
**One-liner:** One place for all Ethiopian tender notices, with email + Telegram alerts so companies and NGOs never miss a deadline.
**Differentiator:** The notification system. Competitor (2merkato) has none. A broken/unreliable notification system is worse than none — treat its reliability as sacred.
**Builder:** Level C — some coding knowledge (JS basics, some Python), learning while building, full-time on this. Explain non-obvious decisions briefly; don't lecture.
**Timeline:** 6–8 weeks to MVP. **Budget:** $0/month — free tiers only. Never suggest paid services during MVP.

## Tech Stack (fixed — do not substitute)

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend/DB/Auth:** Supabase (PostgreSQL, EU/Frankfurt region, Row Level Security)
- **Scrapers:** Python + requests + BeautifulSoup, scheduled via GitHub Actions cron
- **Notifications:** Telegram Bot API (primary, free) + Resend/Brevo email (digest-first to stay in free tier)
- **Hosting:** Vercel free tier
- Details, versions, and setup commands: `agent_docs/tech_stack.md`

## Roadmap & Phases

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| 1. Foundation (Wk 1) | Repo, Next.js deployed to Vercel, Supabase tables + RLS, seed data | "Hello Qellal" live; 20 fake tenders in DB |
| 2. Public core (Wk 2–3) | Listings page, search/filters, tender detail, auth (signup/login/reset) | Browse + filter on mobile; full auth loop works |
| 3. Preferences + Admin (Wk 4) | Notification preferences screen; admin panel with review queue + roles | Staff can publish a tender in <3 min |
| 4. Notifications (Wk 5) | Telegram bot connect, hourly matching job, email digest, dedup log, unsubscribe | Alert arrives <1 hr after a matching tender is published |
| 5. Scrapers + polish (Wk 6) | 1–2 scrapers → review queue; error/empty/loading states; 3G performance pass | Scraped items land in review queue; pages <3s on throttled 3G |
| 6. Beta + launch (Wk 7–8) | Analytics, SEO basics, privacy/terms, beta fixes | End-to-end journey works: browse → sign up → subscribe → alert → open tender |

**Current phase lives in `MEMORY.md` — update it as work progresses.**

## How I Should Think

1. **Understand intent first** — identify what the user actually needs before answering.
2. **Ask if unsure** — one specific clarifying question beats a wrong assumption.
3. **Plan before coding** — propose a brief plan, get approval, then implement.
4. **Verify after changes** — run lint/build/tests or a manual check after each change; fix before moving on.
5. **Explain trade-offs** — when recommending something, mention the alternative in one line.
6. **Teach lightly** — the builder wants to learn: after implementing, note the 2–3 non-obvious decisions made.

## Plan → Execute → Verify (required loop)

- **Plan:** outline the approach (files to touch, data flow) and wait for approval.
- **Execute:** one feature at a time, smallest working slice first.
- **Verify:** `npm run lint && npm run build`, then a concrete manual check (e.g., "open /tenders?category=construction on mobile viewport"). Log completion in `MEMORY.md`.
- **Checkpoint:** commit after each verified slice with a clear message.

## What NOT To Do

- Do NOT delete files without explicit confirmation
- Do NOT modify database schemas without stating a rollback plan
- Do NOT add features outside the current phase (esp. payments, SMS, WhatsApp, native apps — all post-MVP)
  - Note (2026-07-15): **bookmarks/saved tenders promoted INTO scope** by builder decision (feature F10 from the UX research); implemented as `saved_tenders`.
- Do NOT skip verification for "simple" changes
- Do NOT bypass failing checks or pre-commit hooks
- Do NOT suggest paid tiers or new dependencies without checking `package.json` and asking
- Do NOT put secrets in code — env vars only (`.env.local`, never committed)
- Do NOT weaken RLS policies to "make a query work" — fix the policy properly

## Hard Product Rules (from PRD)

- Public listings browsable **without login**; deadlines visually prominent everywhere
- Every tender shows **source attribution + link** (legal requirement)
- Trusted-source scrapes (2merkato) **auto-publish** (`status='published'`) — the source is curated; **manually admin-entered** tenders go to the **review queue** (`status='pending_review'`) before going public
- Mobile-first; pages lightweight (<3s on 3G); test mobile before desktop
- Users can pause/unsubscribe from notifications in one click
- The `plan` field on profiles + a single `canAccess()` check is the only payments scaffolding for now

## Documentation Map (progressive disclosure)

| Need | Read |
|------|------|
| Active phase, decisions, done log | `MEMORY.md` |
| Stack details, setup commands, examples | `agent_docs/tech_stack.md` |
| Code patterns (Supabase, server/client, RLS) | `agent_docs/code_patterns.md` |
| Persistent conventions & commands | `agent_docs/project_brief.md` |
| Full feature specs & success criteria | `agent_docs/product_requirements.md` |
| Testing strategy & verification loop | `agent_docs/testing.md` |
| Pre-merge quality gate | `REVIEW-CHECKLIST.md` |
