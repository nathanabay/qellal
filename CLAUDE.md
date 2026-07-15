# CLAUDE.md — Claude Code Configuration for Qellal

## Project Context
**App:** Qellal — Ethiopian tender aggregation platform with email + Telegram notifications
**Stack:** Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres/Auth/RLS, EU region) · Python scrapers via GitHub Actions · Vercel
**Stage:** MVP development (6–8 weeks, $0 budget)
**User Level:** C — learning while building. Build, then briefly explain non-obvious decisions.

## Directives
1. **Master Plan:** Always read `AGENTS.md` first — it has the roadmap and hard rules. Check `MEMORY.md` for the active phase; update it as work completes.
2. **Documentation:** Pull details from `agent_docs/` as needed (tech_stack, code_patterns, product_requirements, testing). Don't load everything at once.
3. **Plan-First:** Propose a brief plan (files, data flow) and wait for approval before coding.
4. **Incremental Build:** One small feature slice at a time. Verify (lint + build + manual check) before the next.
5. **Quality Gate:** Run `REVIEW-CHECKLIST.md` before calling any feature done. Pre-commit hooks must pass.
6. **Scope Discipline:** Nothing outside the current phase. No payments, SMS, WhatsApp, native apps, or new dependencies without asking.
7. **Communication:** Concise. One specific clarifying question when context is missing. No repeated apologies.

## Commands
- `npm run dev` — start dev server
- `npm run lint` — lint
- `npm run build` — production build (real verification)
- `python scrapers/scrape_<source>.py` — run a scraper locally

## Non-Negotiables
- Secrets in env vars only; service role key never in browser code
- Scrapers write `pending_review` rows only
- Never weaken RLS to make a query pass
- Mobile (375px) tested before desktop
