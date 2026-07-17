# Meilisearch-powered tender search — Design

**Date:** 2026-07-17
**Status:** Approved (design) — pending spec review
**Branch:** feat/ux-report-gaps

## Goal

Replace Qellal's split search (client-side title/buyer filter for open tenders +
Postgres `ilike` for the Closed/All archive) with a single Meilisearch-backed
browse experience: typo-tolerant keyword search, accurate facet counts, and
sorting — unified across open and archive, fast enough to feel instant.

## Decisions (locked)

1. **Hosting:** self-hosted Meilisearch on the user's VPS (159.69.240.169), in
   Docker behind Caddy (HTTPS). The user runs all server commands; the assistant
   never SSHes or handles the server password.
2. **Scope:** Meilisearch is the single backend for keyword + filters + facet
   counts + sorting, for BOTH open and archive. Retires the `TenderBrowser` /
   `ArchiveBrowser` split in favor of one server-driven, paginated, faceted view.
3. **Sync:** scraper pushes new docs on write; a full reindex script runs at the
   end of each scrape and on a daily cron; admin publish/create/reject update the
   index immediately.
4. **Query path:** server-side (Next.js → Meili). No public browser key yet.
5. **Resilience:** if Meili errors, fall back to the existing Postgres query so
   `/tenders` never goes dark.

## Non-goals

- Client-side search-as-you-type with a public key (possible phase 2).
- Changing the alerts/notify matcher (stays regex + synonyms, server-side).
- Indexing non-published tenders.

## Architecture

```
Supabase (source of truth)
   │  (scraper insert, admin publish/create)      ┌───────────────┐
   ├─────────────── push doc ────────────────────▶│               │
   │  (full reindex: end-of-scrape + daily cron)   │  Meilisearch  │
   └─────────────── replace index ────────────────▶│  (VPS/Docker) │
                                                    └──────┬────────┘
   Browser ── /tenders?filters ──▶ Next.js server ── search (q,filter,facet,sort,page) ─┘
                                        │  on error ▼
                                        └── Postgres fallback (getPublishedTendersPage)
```

### Components & boundaries

- **`src/lib/meili.ts`** (app, server-only) — the single search interface.
  - `searchTenders(params): Promise<SearchResult>` — builds the Meili filter/sort
    from browse params, returns `{ hits, total, page, pageSize, facets }`.
  - Uses `MEILI_HOST` + `MEILI_SEARCH_KEY` (search-only scoped key).
  - Never imported by client components.
- **`src/lib/meili-admin.ts`** (app, server-only) — `indexTender(doc)` /
  `removeTender(id)` for admin hooks, using `MEILI_ADMIN_KEY`.
- **`scrapers/src/lib/meili.ts`** — `pushTenders(rows)` (insert-time) and the
  `toSearchDoc(tender)` mapping. Uses `MEILI_HOST` + `MEILI_ADMIN_KEY`.
- **`scrapers/src/reindex.ts`** — reads all published tenders from Supabase,
  (re)applies index settings + synonyms, replaces the index. CLI-invokable.
- **One shared document shape** (`SearchDoc`) documented below; mapping logic is
  small and duplicated between the app-admin hook and the scraper (separate TS
  packages) rather than sharing a module across package boundaries. Keep the two
  mappers byte-identical; the daily reindex is the reconciler of record.

## Index schema — `tenders`

Primary key: `id` (tender UUID; Meili permits hyphens).

`SearchDoc`:
| field | type | purpose |
|---|---|---|
| `id` | string (uuid) | primary key |
| `title` | string | searchable (rank 1) |
| `publishing_entity` | string \| null | searchable (rank 2) |
| `description` | string \| null | searchable (rank 3); HTML-stripped |
| `region` | string \| null | filter + facet |
| `category_ids` | number[] | filter + facet (incl. parent via join) |
| `has_bid_bond` | boolean | filter |
| `deadline_ts` | number (epoch s) | filter: open/closed + "closing in N days" |
| `published_ts` | number (epoch s) | sort: "recently published" |
| `open_rank` | number (0 open / 1 closed) | sort key so scope=all lists open first |
| `deadline` | string (YYYY-MM-DD) | display passthrough |
| `published_on` | string \| null | display passthrough |
| `source_name` | string | display passthrough |
| `bid_bond` | string \| null | display passthrough |
| `posted_at` | string \| null | display passthrough |

Index settings (applied idempotently by reindex):
- `searchableAttributes`: `["title", "publishing_entity", "description"]`
- `filterableAttributes`: `["deadline_ts", "category_ids", "region", "has_bid_bond"]`
- `sortableAttributes`: `["published_ts", "deadline_ts", "open_rank"]`
- `synonyms`: the procurement clusters currently in `scripts/notify.py`
- Default `rankingRules` + typo tolerance (Meili defaults are good).

`published_ts` derivation matches the app's existing rule: parse `published_on`
date tokens (most recent) → else `posted_at` → else `published_date`.

`open_rank` and `deadline_ts` are date-relative; the **daily reindex recomputes
them** so scope filters and open-first ordering don't drift more than a day.

## Query mapping (`searchTenders`)

Input params (from URL, same names as today): `q, scope, category(slug), region,
deadline("7"|"30"), bidBond, sort("recent"|"deadline"), page`.

Build:
- `todayStart` = epoch of today 00:00 (server clock).
- **scope**: open → `deadline_ts >= todayStart`; closed → `deadline_ts < todayStart`;
  all → no scope filter.
- **deadline "7"/"30"**: AND `deadline_ts <= todayStart + N*86400`.
- **category**: resolve slug→id, AND `category_ids = <id>` (matches ANY of a
  tender's categories, parity with today).
- **region**: AND `region = "<region>"`.
- **bidBond**: AND `has_bid_bond = true`.
- **sort**: `recent` → `["open_rank:asc", "published_ts:desc"]`;
  `deadline` → `["open_rank:asc", "deadline_ts:asc"]`. (open_rank keeps open
  tenders above closed under scope=all, matching the current behavior.)
- **facets**: request `category_ids`, `region` → map to the filter dropdown counts.
- **pagination**: `offset = (page-1)*pageSize`, `limit = pageSize` (24), `hitsPerPage`
  or offset/limit; read `estimatedTotalHits`/`totalHits`.

Return `{ hits: TenderCardData[], total, page, pageSize, facets: {category_ids, region} }`.

`/tenders/page.tsx` calls `searchTenders`, renders one browser component with the
facet counts. On any thrown error, it calls `getPublishedTendersPage` (existing)
and renders without Meili facets (dropdowns show labels only) — logged, not shown
to the user as a hard failure.

## Sync

- **Scraper insert** ([upsert.ts](../../../scrapers/src/lib/upsert.ts)): after the
  DB insert returns ids, map fresh rows → `SearchDoc[]` → `pushTenders`. Failures
  are logged, non-fatal (reindex reconciles).
- **Reindex** (`scrapers/src/reindex.ts`, `npm run reindex`): page all published
  tenders from Supabase → map → `index.addDocuments` in batches → apply settings.
  Runs at the end of `scrape.yml` and in a new daily `reindex.yml` cron.
- **Admin hooks** ([admin/actions.ts](../../../src/app/admin/actions.ts)):
  `publishTender`/`createTender` → `indexTender`; `rejectTender` → `removeTender`.
  Non-fatal on error.

## Security

- **Master key** lives only on the VPS (container env). Never in the app or repo.
- **Scoped keys**: `MEILI_SEARCH_KEY` (actions: `search`) for the app queries;
  `MEILI_ADMIN_KEY` (actions: `documents.*`, `indexes.*`, `settings.*`) for
  reindex + admin hooks. Created via the Meili keys API during setup.
- **Transport**: Caddy terminates TLS on `:443`; Meili bound to localhost inside
  Docker. ufw allows only `22` + `443`.
  - **Interim (IP, no domain):** Caddy `tls internal` (self-signed) serves the
    static IP. Traffic — including the API key header — is encrypted, so passive
    sniffing is defeated. The app/scraper Meili clients use a Node fetch agent
    with `rejectUnauthorized: false` (server-side only) since the self-signed cert
    has no public chain. Accepts a small MITM risk for the short interim.
  - **After domain:** point `search.<domain>` → the IP, Caddy issues a public
    Let's Encrypt cert, and TLS verification is re-enabled (drop the insecure
    agent). No app code change beyond `MEILI_HOST` + removing the agent flag.
- **VPS hardening (user-run, recommended):** rotate the shared root password,
  create a non-root sudo user, switch SSH to key-only, enable ufw.

## Environment variables

| Var | Where | Value |
|---|---|---|
| `MEILI_MASTER_KEY` | VPS container | strong secret |
| `MEILI_HOST` | Vercel + Actions | `https://<search-host>` |
| `MEILI_SEARCH_KEY` | Vercel | scoped search key |
| `MEILI_ADMIN_KEY` | Vercel + Actions | scoped admin key |

## Deployment (user-run) — outline

1. Harden: rotate password, non-root user, SSH key, `ufw allow 22,443`.
2. Install Docker + Compose.
3. `docker-compose.yml`: `meilisearch` (env `MEILI_MASTER_KEY`, volume for data,
   bound to `127.0.0.1:7700`) + `caddy` (reverse-proxy `:443` → meili `:7700`).
4. **TLS — interim (no domain yet):** Caddy `tls internal` on `:443` for the
   static IP (self-signed). App/scraper Meili clients skip cert verification
   (server-side). *Later:* add A record `search.<domain>` → 159.69.240.169, Caddy
   auto-issues Let's Encrypt, re-enable verification.
5. Bring up the stack; create `MEILI_SEARCH_KEY` + `MEILI_ADMIN_KEY` via the keys
   API; set env vars in Vercel + GitHub Actions secrets.
6. Run `npm run reindex` once to populate.

## Rollout plan

1. Ship server + index settings + first reindex (search not yet wired in app).
2. Add `searchTenders` + swap `/tenders` to it behind the Postgres fallback.
3. Unify the two browser components into one server-driven, faceted view.
4. Wire scraper push + admin hooks + daily reindex cron.
5. Move synonyms into Meili; keep notify matcher as-is.

## Testing

- Unit: `toSearchDoc` mapping (dates, HTML strip, category_ids, has_bid_bond,
  open_rank); `searchTenders` filter/sort string building (pure, table-driven).
- Integration: reindex against a scratch index; query parity checks (e.g.
  category "consultancy" any-match count matches the DB) using a disposable index.
- Manual: `/tenders` open/closed/all, category+region+deadline+bidBond, sort,
  pagination, facet counts; kill Meili → confirm Postgres fallback renders.

## Risks / open items

- **Single VPS** = single point of failure → mitigated by the Postgres fallback.
- **Interim self-signed TLS** (IP-only): encrypted but unverified until the domain
  is added; small short-term MITM risk. Flip to public TLS once DNS is set.
- **Date drift** of `deadline_ts`/`open_rank` between daily reindexes — bounded to
  <1 day; acceptable.
- **Cross-package doc mapping** duplicated (app vs scraper) — kept in sync by the
  daily reindex being authoritative.
</content>
