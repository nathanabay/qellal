import { getSupabase } from "./supabase";
import type { TenderInput } from "./types";

export type SaveResult = { inserted: number; skipped: number };

// Insert scraped tenders into the review queue, skipping any whose source_url
// already exists (dedupe by attribution link — the stable per-notice id).
// NON-NEGOTIABLE: scrapers only ever write status='pending_review'.
export async function saveTenders(rows: TenderInput[]): Promise<SaveResult> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  const supabase = getSupabase();

  // Resolve category slugs → ids once (small table).
  const { data: cats } = await supabase.from("categories").select("id,slug");
  const slugToId = new Map<string, number>(
    (cats ?? []).map((c: { id: number; slug: string }) => [c.slug, c.id]),
  );

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

  const payload = fresh.map((t) => {
    const { category_slug, ...rest } = t;
    return {
      ...rest,
      category_id: category_slug ? (slugToId.get(category_slug) ?? null) : null,
      status: "pending_review",
      created_by: "scraper",
    };
  });

  const { error: insErr, count } = await supabase
    .from("tenders")
    .insert(payload, { count: "exact" });
  if (insErr) throw new Error(`insert failed: ${insErr.message}`);

  return { inserted: count ?? fresh.length, skipped: urls.length - fresh.length };
}
