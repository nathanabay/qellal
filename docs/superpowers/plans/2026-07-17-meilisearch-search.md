# Meilisearch Tender Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Qellal's split search (client filter for open + Postgres `ilike` for archive) with a single Meilisearch-backed browse — typo-tolerant keyword, accurate facet counts, sorting — for open and archive, with a Postgres fallback.

**Architecture:** Supabase stays the source of truth. A self-hosted Meilisearch (VPS, Docker+Caddy) holds a `tenders` index. The Next.js server queries Meili (`src/lib/meili.ts`) for `/tenders`; on error it falls back to `getPublishedTendersPage`. The scraper pushes docs on insert; a `reindex` script (end-of-scrape + daily cron) reconciles; admin actions update the index live.

**Tech Stack:** Meilisearch (self-hosted), `meilisearch` JS client, Next.js App Router, Supabase, TypeScript, node:test (scraper) / existing app build for typecheck.

**Spec:** `docs/superpowers/specs/2026-07-17-meilisearch-search-design.md`

---

## File structure

| File | Responsibility |
|---|---|
| `infra/meili/docker-compose.yml` | Meili + Caddy stack (user runs on VPS) |
| `infra/meili/Caddyfile` | TLS reverse proxy (interim: `tls internal`) |
| `infra/meili/README.md` | User-run deploy + key-creation runbook |
| `scrapers/src/lib/search-doc.ts` | `toSearchDoc(tender)` + `SearchDoc` type + `publishedTs` (pure) |
| `scrapers/src/lib/meili.ts` | Meili client + `pushTenders`, `applyIndexSettings` |
| `scrapers/src/reindex.ts` | Full reindex CLI (reads Supabase → replaces index) |
| `src/lib/meili.ts` | `searchTenders` + `buildFilter`/`buildSort` (pure) + client |
| `src/lib/meili-admin.ts` | `indexTender` / `removeTender` for admin hooks |
| `src/app/tenders/page.tsx` | Query `searchTenders`, fallback to Postgres |
| `src/components/TenderSearch.tsx` | One server-driven, faceted browser (replaces split) |
| `.github/workflows/reindex.yml` | Daily reindex cron |

---

## Phase 0 — VPS deployment (user-run runbook)

### Task 0: Write the deploy runbook and stack files

**Files:**
- Create: `infra/meili/docker-compose.yml`
- Create: `infra/meili/Caddyfile`
- Create: `infra/meili/README.md`

- [ ] **Step 1: docker-compose.yml**

```yaml
services:
  meilisearch:
    image: getmeili/meilisearch:v1.10
    restart: unless-stopped
    environment:
      MEILI_MASTER_KEY: ${MEILI_MASTER_KEY}
      MEILI_ENV: production
    volumes:
      - meili_data:/meili_data
    expose:
      - "7700"          # not published to host; only Caddy reaches it
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    depends_on:
      - meilisearch
volumes:
  meili_data:
  caddy_data:
```

- [ ] **Step 2: Caddyfile (interim self-signed TLS for the bare IP)**

```
159.69.240.169 {
    tls internal
    reverse_proxy meilisearch:7700
}
```

- [ ] **Step 3: README.md runbook (commands the USER runs on the VPS)**

````markdown
# Meilisearch deploy (Qellal)

> Run these ON THE VPS. Rotate the root password first; ideally create a
> non-root sudo user + SSH key and disable password login.

## 1. Harden
```bash
passwd                      # set a NEW root password
ufw allow 22 && ufw allow 443 && ufw --force enable
```

## 2. Install Docker
```bash
curl -fsSL https://get.docker.com | sh
```

## 3. Deploy
```bash
mkdir -p /opt/meili && cd /opt/meili
# copy docker-compose.yml + Caddyfile here (scp from repo infra/meili/)
export MEILI_MASTER_KEY="$(openssl rand -base64 48 | tr -d /=+ | cut -c1-40)"
echo "MEILI_MASTER_KEY=$MEILI_MASTER_KEY" > .env
echo "SAVE THIS MASTER KEY: $MEILI_MASTER_KEY"
docker compose up -d
```

## 4. Create scoped keys
```bash
# search-only key (for the app)
curl -sk -X POST 'https://159.69.240.169/keys' \
  -H "Authorization: Bearer $MEILI_MASTER_KEY" -H 'Content-Type: application/json' \
  -d '{"description":"qellal-search","actions":["search"],"indexes":["tenders"],"expiresAt":null}'
# admin key (for reindex + admin hooks)
curl -sk -X POST 'https://159.69.240.169/keys' \
  -H "Authorization: Bearer $MEILI_MASTER_KEY" -H 'Content-Type: application/json' \
  -d '{"description":"qellal-admin","actions":["documents.*","indexes.*","settings.*","tasks.get"],"indexes":["tenders"],"expiresAt":null}'
```
Copy each response's `"key"` value.

## 5. Set env (NOT on the VPS — in Vercel + GitHub Actions secrets)
- `MEILI_HOST=https://159.69.240.169`
- `MEILI_SEARCH_KEY=<search key>`
- `MEILI_ADMIN_KEY=<admin key>`
- `MEILI_INSECURE_TLS=1`  (interim; drop once a domain + public cert exist)
````

- [ ] **Step 4: Commit**

```bash
git add infra/meili
git commit -m "chore: meilisearch VPS stack + deploy runbook"
```

- [ ] **Step 5: Hand the runbook to the user**

The user runs Phase 0 on the VPS and provides `MEILI_HOST`, `MEILI_SEARCH_KEY`,
`MEILI_ADMIN_KEY`. Add them to `.env.local` for local dev. Do NOT proceed to
reindex (Task 4 Step 5) until these exist.

---

## Phase 1 — Scraper: document mapping, client, reindex

### Task 1: `SearchDoc` mapping (pure, tested)

**Files:**
- Create: `scrapers/src/lib/search-doc.ts`
- Test: `scrapers/src/lib/search-doc.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { toSearchDoc } from "./search-doc";

const base = {
  id: "a1b2", title: "Road works", publishing_entity: "ERA",
  description: "<p>Build a <b>bridge</b></p>", region: "Oromia",
  category_ids: [37, 28], bid_bond: "10,000", deadline: "2026-07-20",
  published_on: "Jul 16, 2026", published_date: "2026-07-16",
  posted_at: "2026-07-16T09:00:00.000Z", source_name: "2merkato",
};

test("maps fields, strips html, derives flags/timestamps", () => {
  const now = new Date("2026-07-17T00:00:00.000Z");
  const d = toSearchDoc(base, now);
  assert.equal(d.id, "a1b2");
  assert.equal(d.description, "Build a bridge");       // html stripped
  assert.deepEqual(d.category_ids, [37, 28]);
  assert.equal(d.has_bid_bond, true);
  assert.equal(d.deadline_ts, Date.parse("2026-07-20") / 1000);
  assert.equal(d.published_ts, Date.parse("Jul 16, 2026") / 1000);
  assert.equal(d.open_rank, 0);                        // deadline in future
});

test("closed tender gets open_rank 1", () => {
  const now = new Date("2026-07-21T00:00:00.000Z");
  assert.equal(toSearchDoc(base, now).open_rank, 1);
});

test("no bid bond → has_bid_bond false", () => {
  const now = new Date("2026-07-17T00:00:00.000Z");
  assert.equal(toSearchDoc({ ...base, bid_bond: null }, now).has_bid_bond, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scrapers && npx tsx --test src/lib/search-doc.test.ts`
Expected: FAIL (`toSearchDoc` not found).

- [ ] **Step 3: Write the implementation**

```ts
export type SearchDoc = {
  id: string;
  title: string;
  publishing_entity: string | null;
  description: string | null;
  region: string | null;
  category_ids: number[];
  has_bid_bond: boolean;
  deadline_ts: number;   // epoch seconds
  published_ts: number;  // epoch seconds
  open_rank: 0 | 1;      // 0 = open, 1 = closed
  deadline: string;
  published_on: string | null;
  source_name: string;
  bid_bond: string | null;
  posted_at: string | null;
};

type Tenderish = {
  id: string; title: string; publishing_entity?: string | null;
  description?: string | null; region?: string | null;
  category_ids?: number[]; bid_bond?: string | null; deadline: string;
  published_on?: string | null; published_date?: string | null;
  posted_at?: string | null; source_name: string;
};

const TAG = /<[^>]+>/g;

// Most-recent "Published on" date token → else posted_at → else published_date.
function publishedSeconds(t: Tenderish): number {
  const tokens = (t.published_on ?? "").match(/[A-Za-z]{3,9}\.?\s+\d{1,2},\s*\d{4}/g);
  let best = -Infinity;
  for (const tok of tokens ?? []) {
    const ms = Date.parse(tok);
    if (!Number.isNaN(ms) && ms > best) best = ms;
  }
  if (best === -Infinity && t.posted_at) {
    const ms = Date.parse(t.posted_at);
    if (!Number.isNaN(ms)) best = ms;
  }
  if (best === -Infinity && t.published_date) {
    const ms = Date.parse(t.published_date);
    if (!Number.isNaN(ms)) best = ms;
  }
  return best === -Infinity ? 0 : Math.floor(best / 1000);
}

export function toSearchDoc(t: Tenderish, now: Date): SearchDoc {
  const deadlineMs = Date.parse(t.deadline);
  const deadline_ts = Number.isNaN(deadlineMs) ? 0 : Math.floor(deadlineMs / 1000);
  const todayStart = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000,
  );
  return {
    id: t.id,
    title: t.title,
    publishing_entity: t.publishing_entity ?? null,
    description: t.description ? t.description.replace(TAG, " ").replace(/\s+/g, " ").trim() : null,
    region: t.region ?? null,
    category_ids: t.category_ids ?? [],
    has_bid_bond: Boolean(t.bid_bond),
    deadline_ts,
    published_ts: publishedSeconds(t),
    open_rank: deadline_ts >= todayStart ? 0 : 1,
    deadline: t.deadline,
    published_on: t.published_on ?? null,
    source_name: t.source_name,
    bid_bond: t.bid_bond ?? null,
    posted_at: t.posted_at ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scrapers && npx tsx --test src/lib/search-doc.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scrapers/src/lib/search-doc.ts scrapers/src/lib/search-doc.test.ts
git commit -m "feat(scraper): toSearchDoc mapping for meilisearch"
```

### Task 2: Meili client + index settings (scraper side)

**Files:**
- Modify: `scrapers/package.json` (add `meilisearch` dep + `reindex` script)
- Create: `scrapers/src/lib/meili.ts`

- [ ] **Step 1: Add the dependency**

Run: `cd scrapers && npm install meilisearch`
Expected: `meilisearch` added to dependencies.

- [ ] **Step 2: Write the client + settings module**

```ts
import { MeiliSearch, type Index } from "meilisearch";
import type { SearchDoc } from "./search-doc";

const INDEX = "tenders";

let client: MeiliSearch | null = null;
export function getMeili(): MeiliSearch {
  const host = process.env.MEILI_HOST;
  const apiKey = process.env.MEILI_ADMIN_KEY;
  if (!host || !apiKey) throw new Error("MEILI_HOST and MEILI_ADMIN_KEY required");
  if (!client) {
    // Interim self-signed cert: allow insecure TLS when MEILI_INSECURE_TLS=1.
    if (process.env.MEILI_INSECURE_TLS === "1") {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
    client = new MeiliSearch({ host, apiKey });
  }
  return client;
}

export function tendersIndex(): Index<SearchDoc> {
  return getMeili().index<SearchDoc>(INDEX);
}

export async function applyIndexSettings(synonyms: Record<string, string[]>): Promise<void> {
  await getMeili().createIndex(INDEX, { primaryKey: "id" }).catch(() => {});
  const idx = tendersIndex();
  await idx.updateSettings({
    searchableAttributes: ["title", "publishing_entity", "description"],
    filterableAttributes: ["deadline_ts", "category_ids", "region", "has_bid_bond"],
    sortableAttributes: ["published_ts", "deadline_ts", "open_rank"],
    synonyms,
  });
}

export async function pushTenders(docs: SearchDoc[]): Promise<void> {
  if (docs.length === 0) return;
  await tendersIndex().addDocuments(docs, { primaryKey: "id" });
}
```

- [ ] **Step 3: Typecheck**

Run: `cd scrapers && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add scrapers/package.json scrapers/package-lock.json scrapers/src/lib/meili.ts
git commit -m "feat(scraper): meilisearch client + index settings"
```

### Task 3: Synonyms module (shared source of truth)

**Files:**
- Create: `scrapers/src/lib/synonyms.ts`

- [ ] **Step 1: Extract the clusters from notify.py into a Meili synonyms map**

```ts
// Bidirectional procurement synonyms for Meilisearch (mirrors scripts/notify.py
// SYNONYM_CLUSTERS). Meili wants a map of term -> [synonyms]; expand each cluster
// so every term maps to its siblings.
const CLUSTERS: string[][] = [
  ["it", "ict", "information technology", "software", "computer", "it support", "help desk", "service desk", "networking"],
  ["construction", "building", "civil works", "contractor", "renovation", "road", "bridge", "infrastructure"],
  ["vehicle", "car", "truck", "automobile", "fleet", "spare parts"],
  ["medical", "medicine", "pharmaceutical", "drugs", "hospital", "clinical", "laboratory", "diagnostic"],
  ["consultancy", "consulting", "consultant", "advisory", "technical assistance", "feasibility study"],
  ["security", "guard", "surveillance", "cctv"],
  ["furniture", "office equipment", "stationery"],
  ["training", "capacity building", "workshop", "seminar"],
  ["cleaning", "sanitation", "janitorial", "hygiene"],
  ["electrical", "electricity", "power", "generator", "solar"],
  ["water", "borehole", "irrigation", "wash", "plumbing"],
  ["catering", "food", "nutrition"],
  ["transport", "logistics", "freight", "shipping", "courier"],
  ["printing", "publishing", "graphic design"],
  ["insurance", "audit", "accounting", "financial services"],
];

export function meiliSynonyms(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const cluster of CLUSTERS) {
    for (const term of cluster) map[term] = cluster.filter((x) => x !== term);
  }
  return map;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd scrapers && npx tsc --noEmit -p tsconfig.json` → exit 0

```bash
git add scrapers/src/lib/synonyms.ts
git commit -m "feat(scraper): meilisearch synonyms map"
```

### Task 4: Reindex CLI

**Files:**
- Create: `scrapers/src/reindex.ts`
- Modify: `scrapers/package.json` (`"reindex": "tsx src/reindex.ts"`)

- [ ] **Step 1: Write the reindex script**

```ts
import { getSupabase } from "./lib/supabase";
import { toSearchDoc } from "./lib/search-doc";
import { applyIndexSettings, tendersIndex } from "./lib/meili";
import { meiliSynonyms } from "./lib/synonyms";

const COLS =
  "id,title,publishing_entity,description,region,bid_bond,deadline," +
  "published_on,published_date,posted_at,source_name,category_id," +
  "tender_categories(category_id)";

async function main() {
  const supabase = getSupabase();
  await applyIndexSettings(meiliSynonyms());
  const idx = tendersIndex();

  const now = new Date();
  const pageSize = 1000;
  let total = 0;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("tenders").select(COLS).eq("status", "published")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`reindex fetch failed: ${error.message}`);
    const rows = data ?? [];
    if (rows.length === 0) break;
    const docs = rows.map((r: any) => {
      const ids = (r.tender_categories ?? []).map((tc: any) => tc.category_id);
      if (ids.length === 0 && r.category_id != null) ids.push(r.category_id);
      return toSearchDoc({ ...r, category_ids: ids }, now);
    });
    await idx.addDocuments(docs, { primaryKey: "id" });
    total += docs.length;
    console.log(`  indexed ${total}…`);
    if (rows.length < pageSize) break;
  }
  console.log(`Reindex complete: ${total} documents.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add the npm script**

In `scrapers/package.json` `scripts`, add: `"reindex": "tsx src/reindex.ts"`

- [ ] **Step 3: Typecheck**

Run: `cd scrapers && npx tsc --noEmit -p tsconfig.json` → exit 0

- [ ] **Step 4: Commit**

```bash
git add scrapers/src/reindex.ts scrapers/package.json
git commit -m "feat(scraper): full reindex CLI"
```

- [ ] **Step 5: Populate the index (requires Phase 0 env)**

Run (with `MEILI_HOST`/`MEILI_ADMIN_KEY`/`MEILI_INSECURE_TLS` + Supabase env set):
`cd scrapers && SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run reindex`
Expected: `Reindex complete: <~7500> documents.`

---

## Phase 2 — App search library (+ fallback)

### Task 5: `buildFilter` / `buildSort` (pure, tested)

**Files:**
- Create: `src/lib/meili.ts` (filter/sort builders first; client added in Task 6)
- Test: `src/lib/meili.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFilter, buildSort } from "./meili";

const T = 1_752_710_400; // fixed todayStart epoch (2026-07-17 UTC)

test("open scope filters future deadlines", () => {
  assert.deepEqual(buildFilter({ scope: "open" }, T), [`deadline_ts >= ${T}`]);
});
test("closed scope filters past deadlines", () => {
  assert.deepEqual(buildFilter({ scope: "closed" }, T), [`deadline_ts < ${T}`]);
});
test("all scope + category + region + bidBond + deadline7", () => {
  assert.deepEqual(
    buildFilter({ scope: "all", categoryId: 45, region: "Oromia", bidBond: true, deadline: "7" }, T),
    [`category_ids = 45`, `region = "Oromia"`, `has_bid_bond = true`, `deadline_ts <= ${T + 7 * 86400}`],
  );
});
test("sort maps to open-first + field", () => {
  assert.deepEqual(buildSort("recent"), ["open_rank:asc", "published_ts:desc"]);
  assert.deepEqual(buildSort("deadline"), ["open_rank:asc", "deadline_ts:asc"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/meili.test.ts`
Expected: FAIL (`buildFilter` not found).

- [ ] **Step 3: Write the builders**

```ts
export type SearchParams = {
  q?: string;
  scope?: "open" | "closed" | "all";
  categoryId?: number;
  region?: string;
  deadline?: "" | "7" | "30";
  bidBond?: boolean;
  sort?: "recent" | "deadline";
  page?: number;
};

export function buildFilter(p: SearchParams, todayStart: number): string[] {
  const f: string[] = [];
  if (p.scope === "open") f.push(`deadline_ts >= ${todayStart}`);
  else if (p.scope === "closed") f.push(`deadline_ts < ${todayStart}`);
  if (p.categoryId) f.push(`category_ids = ${p.categoryId}`);
  if (p.region) f.push(`region = "${p.region.replace(/"/g, '\\"')}"`);
  if (p.bidBond) f.push(`has_bid_bond = true`);
  if (p.deadline === "7" || p.deadline === "30") {
    f.push(`deadline_ts <= ${todayStart + Number(p.deadline) * 86400}`);
  }
  return f;
}

export function buildSort(sort: "recent" | "deadline" | undefined): string[] {
  return sort === "recent"
    ? ["open_rank:asc", "published_ts:desc"]
    : ["open_rank:asc", "deadline_ts:asc"];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/meili.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/meili.ts src/lib/meili.test.ts
git commit -m "feat: meili filter/sort builders"
```

### Task 6: `searchTenders` (client + query) with typed result

**Files:**
- Modify: `src/lib/meili.ts`
- Modify: `package.json` (add `meilisearch`)

- [ ] **Step 1: Add the dependency**

Run: `npm install meilisearch` → added to dependencies.

- [ ] **Step 2: Add the client + searchTenders**

Append to `src/lib/meili.ts`:

```ts
import { MeiliSearch } from "meilisearch";
import type { TenderCardData } from "@/components/TenderCard";

export type SearchResult = {
  hits: TenderCardData[];
  total: number;
  page: number;
  pageSize: number;
  facets: { category_ids: Record<string, number>; region: Record<string, number> };
};

let client: MeiliSearch | null = null;
function getClient(): MeiliSearch {
  const host = process.env.MEILI_HOST!;
  const apiKey = process.env.MEILI_SEARCH_KEY!;
  if (process.env.MEILI_INSECURE_TLS === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  if (!client) client = new MeiliSearch({ host, apiKey });
  return client;
}

export function meiliConfigured(): boolean {
  return Boolean(process.env.MEILI_HOST && process.env.MEILI_SEARCH_KEY);
}

export async function searchTenders(p: SearchParams): Promise<SearchResult> {
  const pageSize = 24;
  const page = Math.max(1, p.page ?? 1);
  const now = new Date();
  const todayStart = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000,
  );
  const res = await getClient().index("tenders").search(p.q ?? "", {
    filter: buildFilter(p, todayStart),
    sort: buildSort(p.sort),
    facets: ["category_ids", "region"],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const hits = (res.hits as unknown[]).map((h) => {
    const d = h as Record<string, unknown>;
    return {
      id: d.id, title: d.title, region: d.region, deadline: d.deadline,
      source_name: d.source_name, publishing_entity: d.publishing_entity,
      category_id: (d.category_ids as number[])?.[0] ?? null,
      category_ids: d.category_ids as number[],
      bid_bond: d.bid_bond, published_date: null, published_on: d.published_on,
    } as unknown as TenderCardData;
  });
  const dist = res.facetDistribution ?? {};
  return {
    hits,
    total: res.estimatedTotalHits ?? res.totalHits ?? hits.length,
    page,
    pageSize,
    facets: {
      category_ids: (dist.category_ids as Record<string, number>) ?? {},
      region: (dist.region as Record<string, number>) ?? {},
    },
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build` (or `npx tsc --noEmit`)
Expected: compiles (the pure tests from Task 5 still pass).

- [ ] **Step 4: Commit**

```bash
git add src/lib/meili.ts package.json package-lock.json
git commit -m "feat: searchTenders meili query"
```

---

## Phase 3 — Wire `/tenders` to Meili (with Postgres fallback) + unified UI

### Task 7: Unified `TenderSearch` component

**Files:**
- Create: `src/components/TenderSearch.tsx`

- [ ] **Step 1: Build a server-driven, faceted browser**

Adapt the existing `ArchiveBrowser` (server-paginated, debounced URL nav) into a
single component that:
- renders `ScopeToggle` + `TenderFilters` + result count + cards + prev/next,
- receives `categoryCounts`/`regionCounts` from Meili facets (map facet id→slug
  using the passed `categories` list) so dropdowns show live counts in EVERY
  scope,
- reuses the debounced `router.push` navigation from `ArchiveBrowser` for filter
  changes (same param names: `q,scope,category,region,deadline,bidBond,sort,page`).

Full component code: copy `src/components/ArchiveBrowser.tsx`, then:
1. add `categoryCounts`/`regionCounts` props (`Record<string,number>`),
2. pass them to `<TenderFilters categoryCounts=… regionCounts=… scopeTotal={total}/>`,
3. keep the scope toggle (already a nav link component).

- [ ] **Step 2: Typecheck + commit**

Run: `npm run build` → compiles

```bash
git add src/components/TenderSearch.tsx
git commit -m "feat: unified faceted TenderSearch component"
```

### Task 8: Point `/tenders` at Meili with fallback

**Files:**
- Modify: `src/app/tenders/page.tsx`

- [ ] **Step 1: Replace the open/archive branch with a single Meili query**

Build `SearchParams` from `searchParams` (resolve category slug→id via
`categories`), then:

```ts
import { searchTenders, meiliConfigured } from "@/lib/meili";
// …
let facets: { category_ids: Record<string, number>; region: Record<string, number> } = {
  category_ids: {}, region: {},
};
let tenders; let total; let usedMeili = false;
if (meiliConfigured()) {
  try {
    const r = await searchTenders(params);
    tenders = r.hits; total = r.total; facets = r.facets; usedMeili = true;
  } catch (e) {
    console.error("meili search failed, falling back to postgres:", e);
  }
}
if (!usedMeili) {
  const r = await getPublishedTendersPage({ filters, sort, page: pageNum, pageSize: 24 });
  if (r.state === "ok") { tenders = r.tenders; total = r.total; }
  // facets stay empty → dropdowns show labels only
}
```

Map Meili facets (`category_ids` keyed by id) to slug-keyed counts for
`TenderFilters` using the `categories` list. Render `<TenderSearch … categoryCounts=… regionCounts=… total=… tenders=… scope=… page=…/>`.

- [ ] **Step 2: Manual verification**

Run the dev server; verify at 375px and desktop:
- `/tenders` (open), `/tenders?scope=closed`, `/tenders?scope=all`
- keyword (typo e.g. `constructon` still matches — typo tolerance)
- category + region + deadline + bidBond, sort recent/deadline, pagination
- facet counts appear in EVERY scope
- Stop Meili (or unset `MEILI_HOST`) → confirm Postgres fallback renders (no crash)

- [ ] **Step 3: Commit**

```bash
git add src/app/tenders/page.tsx
git commit -m "feat: /tenders search via meilisearch with postgres fallback"
```

### Task 9: Remove the now-dead split (only after Task 8 verified)

**Files:**
- Delete: `src/components/ArchiveBrowser.tsx` (superseded by `TenderSearch`)
- Modify: `src/components/TenderBrowser.tsx` — keep ONLY if still used elsewhere;
  else delete. Grep first: `grep -rn "TenderBrowser\|ArchiveBrowser" src`.

- [ ] **Step 1: Grep usages, delete unused files, fix imports**
- [ ] **Step 2: `npm run build` → compiles; `node scripts/perf-budget.mjs` → within budget**
- [ ] **Step 3: Commit** `git commit -m "refactor: retire split browser components"`

---

## Phase 4 — Live sync (scraper insert, admin hooks, cron)

### Task 10: Scraper pushes new docs on insert

**Files:**
- Modify: `scrapers/src/lib/upsert.ts`

- [ ] **Step 1: After the insert returns ids, push to Meili (non-fatal)**

In `saveTenders`, after `insertedRows` is obtained and joins are written, add:

```ts
try {
  const now = new Date();
  const byUrl = new Map(fresh.map((t) => [t.source_url, t]));
  const docs = (insertedRows ?? []).map((r: { id: string; source_url: string }) => {
    const t = byUrl.get(r.source_url)!;
    const ids = t.categories.map((c) => slugToId.get(c.slug)).filter((x): x is number => !!x);
    return toSearchDoc({ ...t, id: r.id, category_ids: ids }, now);
  });
  await pushTenders(docs);
} catch (e) {
  console.error("meili push failed (non-fatal):", (e as Error).message);
}
```

Add imports: `import { toSearchDoc } from "./search-doc"; import { pushTenders } from "./meili";`
Guard: skip if `!process.env.MEILI_HOST` (so DRY runs / no-meili envs don't throw).

- [ ] **Step 2: Typecheck + commit**

Run: `cd scrapers && npx tsc --noEmit -p tsconfig.json` → exit 0

```bash
git add scrapers/src/lib/upsert.ts
git commit -m "feat(scraper): push new tenders to meilisearch on insert"
```

### Task 11: Admin hooks index live

**Files:**
- Create: `src/lib/meili-admin.ts`
- Modify: `src/app/admin/actions.ts` (`publishTender`, `createTender`, `rejectTender`)

- [ ] **Step 1: Admin write helpers**

```ts
import "server-only";
import { MeiliSearch } from "meilisearch";

function admin(): MeiliSearch | null {
  const host = process.env.MEILI_HOST, apiKey = process.env.MEILI_ADMIN_KEY;
  if (!host || !apiKey) return null;
  if (process.env.MEILI_INSECURE_TLS === "1") process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  return new MeiliSearch({ host, apiKey });
}

export async function indexTender(doc: Record<string, unknown>): Promise<void> {
  try { await admin()?.index("tenders").addDocuments([doc], { primaryKey: "id" }); }
  catch (e) { console.error("meili indexTender failed:", (e as Error).message); }
}
export async function removeTender(id: string): Promise<void> {
  try { await admin()?.index("tenders").deleteDocument(id); }
  catch (e) { console.error("meili removeTender failed:", (e as Error).message); }
}
```

- [ ] **Step 2: Call them from the admin actions**

- `publishTender`/`createTender`: after the DB write, build the doc (fetch the row
  with the same columns used in reindex, map with a copy of `toSearchDoc` in
  `src/lib/search-doc.ts` — create it mirroring the scraper's) and `indexTender`.
- `rejectTender`: `await removeTender(id)`.

Create `src/lib/search-doc.ts` as a byte-identical copy of the scraper mapper
(app package can't import across the scrapers package).

- [ ] **Step 3: Build + commit**

Run: `npm run build` → compiles

```bash
git add src/lib/meili-admin.ts src/lib/search-doc.ts src/app/admin/actions.ts
git commit -m "feat: admin actions keep meilisearch in sync"
```

### Task 12: Daily reindex cron + end-of-scrape reindex

**Files:**
- Create: `.github/workflows/reindex.yml`
- Modify: `.github/workflows/scrape.yml` (run `npm run reindex` after scraping)

- [ ] **Step 1: reindex.yml**

```yaml
name: Reindex search
on:
  schedule: [{ cron: "0 4 * * *" }]   # 04:00 UTC daily
  workflow_dispatch: {}
jobs:
  reindex:
    runs-on: ubuntu-latest
    environment: Production
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: "20", cache: "npm", cache-dependency-path: scrapers/package-lock.json }
      - run: cd scrapers && npm ci
      - run: cd scrapers && npm run reindex
        env:
          SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          MEILI_HOST: ${{ secrets.MEILI_HOST }}
          MEILI_ADMIN_KEY: ${{ secrets.MEILI_ADMIN_KEY }}
          MEILI_INSECURE_TLS: "1"
```

- [ ] **Step 2: Add a reindex step at the end of scrape.yml**

After the scrape step, add a step running `cd scrapers && npm run reindex` with
the same `MEILI_*` + Supabase env.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/reindex.yml .github/workflows/scrape.yml
git commit -m "ci: daily + post-scrape meilisearch reindex"
```

---

## Phase 5 — Cleanup

### Task 13: Retire the Postgres `or()` search? (NO — keep as fallback)

- [ ] Confirm `getPublishedTendersPage` + `src/lib/search.ts` remain (the fallback
  path depends on them). No deletion. Add a comment in `page.tsx` noting they are
  the Meili fallback.
- [ ] Commit any comment-only change.

---

## Self-review notes

- **Spec coverage:** server (Task 0), index schema/settings (Tasks 1-2), synonyms
  (Task 3), reindex (Task 4), query mapping (Tasks 5-6), unified UI + facets
  (Tasks 7-8), fallback (Task 8), sync scraper/admin/cron (Tasks 10-12), security
  (Task 0 keys + `MEILI_INSECURE_TLS`). Covered.
- **`toSearchDoc` duplicated** in `scrapers/src/lib/search-doc.ts` and
  `src/lib/search-doc.ts` by design (package boundary); reindex is authoritative.
- **Type consistency:** `SearchParams`, `SearchResult`, `SearchDoc`, `buildFilter`,
  `buildSort`, `searchTenders`, `pushTenders`, `indexTender`, `removeTender` used
  consistently across tasks.
- **Env:** `MEILI_HOST`, `MEILI_SEARCH_KEY`, `MEILI_ADMIN_KEY`, `MEILI_INSECURE_TLS`
  — same names in app, scraper, and CI.
</content>
