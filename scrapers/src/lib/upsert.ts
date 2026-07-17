import { getSupabase } from "./supabase";
import { toSearchDoc } from "./search-doc";
import { pushTenders } from "./meili";
import type { TenderInput, TaxonomyRow } from "./types";

export type SaveResult = { inserted: number; skipped: number };

// Sync 2merkato's category taxonomy into the `categories` table so the stored
// hierarchy (parent_id) and order (position) stay identical to 2merkato after
// every scrape — instead of drifting as leaf categories are created ad hoc.
// Two passes: upsert names+positions first (so every row exists), then resolve
// parent slugs → ids and set parent_id.
export async function syncCategoryTaxonomy(rows: TaxonomyRow[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = getSupabase();

  // Pass 1: upsert name + position by slug (creates missing, updates existing).
  const { error: upErr } = await supabase
    .from("categories")
    .upsert(
      rows.map((r) => ({ name: r.name, slug: r.slug, position: r.position })),
      { onConflict: "slug" },
    );
  if (upErr) {
    console.error("category taxonomy upsert failed:", upErr.message);
    return;
  }

  // Pass 2: resolve slugs → ids, then set parent_id for every row (null for
  // top-level, so re-parented/promoted categories self-correct each run).
  const { data: cats, error: selErr } = await supabase
    .from("categories")
    .select("id,slug");
  if (selErr) {
    console.error("category id lookup failed:", selErr.message);
    return;
  }
  const idBySlug = new Map<string, number>(
    (cats ?? []).map((c: { id: number; slug: string }) => [c.slug, c.id]),
  );
  const parentUpdates = rows
    .filter((r) => idBySlug.has(r.slug))
    .map((r) => ({
      id: idBySlug.get(r.slug)!,
      parent_id: r.parentSlug ? (idBySlug.get(r.parentSlug) ?? null) : null,
    }));
  const { error: pErr } = await supabase
    .from("categories")
    .upsert(parentUpdates, { onConflict: "id" });
  if (pErr) console.error("category parent sync failed:", pErr.message);
}

// Every source_url already stored (any status), so a scraper can skip tenders
// it has seen before instead of re-fetching their detail pages.
export async function getExistingSourceUrls(): Promise<Set<string>> {
  const supabase = getSupabase();
  const urls = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("tenders")
      .select("source_url")
      .not("source_url", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`load existing urls failed: ${error.message}`);
    const rows = (data ?? []) as { source_url: string | null }[];
    for (const r of rows) if (r.source_url) urls.add(r.source_url);
    if (rows.length < pageSize) break;
  }
  return urls;
}

// Insert scraped tenders into the review queue, skipping any whose source_url
// already exists (dedupe by attribution link — the stable per-notice id).
// NON-NEGOTIABLE: scrapers only ever write status='pending_review'.
export async function saveTenders(rows: TenderInput[]): Promise<SaveResult> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  const supabase = getSupabase();

  // Ensure a categories row exists for every 2merkato category in this batch,
  // then resolve slug → id. New categories are created on the fly.
  const wantCats = new Map<string, string>(); // slug -> name
  for (const r of rows) {
    for (const c of r.categories) wantCats.set(c.slug, c.name);
  }
  const { data: cats } = await supabase.from("categories").select("id,slug");
  const slugToId = new Map<string, number>(
    (cats ?? []).map((c: { id: number; slug: string }) => [c.slug, c.id]),
  );
  const missing = [...wantCats.entries()]
    .filter(([slug]) => !slugToId.has(slug))
    .map(([slug, name]) => ({ name, slug }));
  if (missing.length > 0) {
    await supabase
      .from("categories")
      .upsert(missing, { onConflict: "slug", ignoreDuplicates: true });
    const { data: refreshed } = await supabase
      .from("categories")
      .select("id,slug");
    slugToId.clear();
    for (const c of (refreshed ?? []) as { id: number; slug: string }[])
      slugToId.set(c.slug, c.id);
  }

  // Collapse duplicate source_urls within this batch first.
  const byUrl = new Map<string, TenderInput>();
  for (const r of rows) byUrl.set(r.source_url, r);
  const urls = [...byUrl.keys()];

  // Which of these do we already have (in any status)?
  const { data: existing, error } = await supabase
    .from("tenders")
    .select("source_url")
    .in("source_url", urls);
  if (error) throw new Error(`dedupe query failed: ${error.message}`);

  const seen = new Set(
    (existing ?? []).map((e: { source_url: string | null }) => e.source_url),
  );
  const fresh = urls.filter((u) => !seen.has(u)).map((u) => byUrl.get(u)!);
  if (fresh.length === 0) return { inserted: 0, skipped: urls.length };

  // Scraped tenders auto-publish (manual admin entries are what get reviewed).
  const nowIso = new Date().toISOString();
  const payload = fresh.map((t) => {
    const { categories, ...rest } = t;
    const primary = categories[0]?.slug;
    return {
      ...rest,
      category_id: primary ? (slugToId.get(primary) ?? null) : null,
      // published_date drives listing order; fall back to today if unknown.
      published_date: rest.published_date ?? nowIso.slice(0, 10),
      status: "published",
      created_by: "scraper",
      published_at: nowIso,
    };
  });

  // Insert tenders and get their ids back so we can write the category join rows.
  let { data: insertedRows, error: insErr } = await supabase
    .from("tenders")
    .insert(payload)
    .select("id,source_url");
  if (insErr && /posted_at/.test(insErr.message)) {
    // posted_at column not migrated (0023) yet — retry without it so the scrape
    // still lands rows; posted_at fills in once the migration is applied.
    const stripped = payload.map(({ posted_at, ...rest }) => rest);
    ({ data: insertedRows, error: insErr } = await supabase
      .from("tenders")
      .insert(stripped)
      .select("id,source_url"));
  }
  if (insErr) throw new Error(`insert failed: ${insErr.message}`);

  const urlToId = new Map(
    (insertedRows ?? []).map((r: { id: string; source_url: string }) => [
      r.source_url,
      r.id,
    ]),
  );
  const joins: { tender_id: string; category_id: number }[] = [];
  for (const t of fresh) {
    const tid = urlToId.get(t.source_url);
    if (!tid) continue;
    for (const c of t.categories) {
      const cid = slugToId.get(c.slug);
      if (cid) joins.push({ tender_id: tid, category_id: cid });
    }
  }
  if (joins.length > 0) {
    const { error: jErr } = await supabase
      .from("tender_categories")
      .upsert(joins, { onConflict: "tender_id,category_id", ignoreDuplicates: true });
    if (jErr) console.error("tender_categories insert failed:", jErr.message);
  }

  // Mirror the new tenders into Meilisearch as they land (non-fatal; the daily
  // reindex reconciles). Skipped when Meili isn't configured (dry runs / no env).
  if (process.env.MEILI_HOST) {
    try {
      const now = new Date();
      const docs = fresh
        .map((t) => {
          const tid = urlToId.get(t.source_url);
          if (!tid) return null;
          const ids = t.categories
            .map((c) => slugToId.get(c.slug))
            .filter((x): x is number => x != null);
          return toSearchDoc({ ...t, id: tid, category_ids: ids }, now);
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);
      await pushTenders(docs);
    } catch (e) {
      console.error("meili push failed (non-fatal):", (e as Error).message);
    }
  }

  return {
    inserted: insertedRows?.length ?? fresh.length,
    skipped: urls.length - fresh.length,
  };
}
