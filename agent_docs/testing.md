# Testing Strategy — Qellal

## Philosophy
Level C builder on a 6–8 week clock: prioritize a tight manual verification loop + a few high-value automated tests over coverage numbers. The one thing that must NEVER silently break: the notification pipeline.

## Tools
- **Lint/format:** ESLint + Prettier (`npm run lint`)
- **Build check:** `npm run build` — the cheapest real verification; run before every commit
- **Unit tests (targeted):** Vitest — only for pure logic: the matching function (tender ↔ subscription) and date/deadline utilities
- **E2E (from Phase 4 on):** Playwright, one script for the golden path: browse → sign up → subscribe → (trigger publish) → alert logged → open tender
- **Scrapers:** run locally against saved HTML fixtures before scheduling; assert required fields present

## Manual Checks (per feature — see REVIEW-CHECKLIST.md)
1. Mobile viewport (375px) first, then desktop
2. Chrome DevTools "Slow 3G" throttle — page usable <3s
3. Loading / empty / error states visible
4. RLS: repeat the action as anonymous and as a normal user — pending tenders must be invisible

## Verification Loop (every change)
```
npm run lint && npm run build
→ manual check of the specific behavior changed
→ log one line in MEMORY.md Done Log
→ commit
```
If verification fails: fix before continuing. Never stack unverified changes.

## Pre-Commit Hooks
Set up simple git hooks (husky or plain `.git/hooks/pre-commit`) running lint + build once the project stabilizes (Phase 2). Do not bypass failing hooks; ask the builder if a bypass seems needed.

## Notification Pipeline Tests (Phase 4 — highest stakes)
- Unit-test the matcher: category match, keyword match, region filter, no-match
- Idempotency: run the send job twice → second run sends nothing (unique constraint holds)
- Unsubscribe: /stop and email link both halt sends, verified by a follow-up job run
