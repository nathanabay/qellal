# Project Brief (Persistent) — Qellal

- **Product vision:** One place for all Ethiopian tender notices, with reliable email + Telegram alerts so companies and NGOs never miss a deadline. Beat 2merkato on user experience.
- **Builder profile:** Level C — JS/Python basics, full-time, learning while building. Agent builds, briefly explains non-obvious decisions.
- **Coding conventions:** TypeScript everywhere in the web app (no `any`); server components by default; Tailwind only; snake_case DB, PascalCase components; one Python file per scraper source.
- **Architecture rules:** business logic in `lib/`, not in page components; scrapers isolated in `/scrapers` — trusted sources (2merkato) auto-publish (`status='published'`), while manual admin entries use the `pending_review` review queue; single `canAccess()` gate for future payments.
- **Quality gates:** `npm run lint` + `npm run build` before every commit; mobile (375px) tested before desktop; `REVIEW-CHECKLIST.md` before marking any feature done; RLS tested with a non-admin account.
- **Key commands:**
  - `npm run dev` — dev server
  - `npm run lint` — lint
  - `npm run build` — production build (the real verification)
  - `python scrapers/scrape_<source>.py` — run a scraper locally
- **Budget rule:** $0/month. No paid tiers, no new dependencies without asking.
- **Update cadence:** refresh this brief + `MEMORY.md` at each phase transition; update `AGENTS.md` roadmap if scope changes.
