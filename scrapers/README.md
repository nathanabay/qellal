# Qellal scrapers

Crawlee-based tender scrapers. **Isolated from the Next.js app** (own
`package.json`, off the Vercel build). Sources write **`pending_review` rows
only** — nothing is ever published directly.

## Design

- **`CheerioCrawler` (HTTP-only, no browser).** `tender.2merkato.com` is an
  Inertia.js app that server-embeds its tender list in the page's
  `<div id="app" data-page="…">` JSON, so we parse that directly — fast, cheap,
  CI-friendly. If a future source is truly JS-rendered, swap in
  `PlaywrightCrawler` for just that source.
- **Subscriber login (optional).** Set `MERKATO_USERNAME` / `MERKATO_PASSWORD`
  and the scraper performs the Inertia login handshake, which unlocks the
  `bid_closing_date` that non-subscribers see as "Subscription required". All
  deadline data is read from the list payload — no per-tender detail requests.
  Without credentials it falls back to the ~20% of tenders with public
  deadlines.
- **Dedupe by `source_url`** (the stable per-notice link), so re-running is
  idempotent.
- **Legal:** public listing metadata + attribution link only. We do not
  download the paywalled bid documents.

## Layout

```
src/
  lib/types.ts     TenderInput — the normalized row shape
  lib/supabase.ts  service-role client (lazy; env only)
  lib/upsert.ts    dedupe + insert pending_review
  sources/2merkato.ts
  main.ts          CLI: npm run scrape -- <source> [pages]
```

## Run locally

```bash
cd scrapers
npm install

# Dry run — extract + print, writes nothing, no DB creds needed:
DRY_RUN=1 npm run scrape -- 2merkato 3

# Real run — needs credentials:
export SUPABASE_URL=https://<project>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role secret>
npm run scrape -- 2merkato 3
```

## Scheduling

`.github/workflows/scrape.yml` runs every 6h. Requires repo secrets
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Manual runs (workflow_dispatch)
default to `dry_run=1`.

## Adding a source

1. Create `src/sources/<name>.ts` exporting
   `async (pages?) => Promise<TenderInput[]>`.
2. Register it in `SOURCES` in `main.ts`.
3. Always set `source_name` + `source_url`; never set `status`/`created_by`
   (the upsert layer owns those).
