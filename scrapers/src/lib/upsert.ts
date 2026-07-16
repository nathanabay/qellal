import { getSupabase } from "./supabase";
import type { TenderInput } from "./types";

export type SaveResult = { inserted: number; skipped: number };

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

  // Ensure a categories row exists for each 2merkato category in this batch,
  // then resolve slug → id. New categories are created on the fly.
  const wantCats = new Map<string, string>(); // slug -> name
  for (const r of rows) {
    if (r.category_slug && r.category_name)
      wantCats.set(r.category_slug, r.category_name);
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
    const { category_slug, category_name: _name, ...rest } = t;
    void _name;
    return {
      ...rest,
      category_id: category_slug ? (slugToId.get(category_slug) ?? null) : null,
      // published_date drives listing order; fall back to today if unknown.
      published_date: rest.published_date ?? nowIso.slice(0, 10),
      status: "published",
      created_by: "scraper",
      published_at: nowIso,
    };
  });

  const { error: insErr, count } = await supabase
    .from("tenders")
    .insert(payload, { count: "exact" });
  if (insErr) throw new Error(`insert failed: ${insErr.message}`);

  return { inserted: count ?? fresh.length, skipped: urls.length - fresh.length };
}
