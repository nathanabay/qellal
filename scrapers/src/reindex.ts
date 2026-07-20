import { getSupabase } from "./lib/supabase";
import { toSearchDoc } from "./lib/search-doc";
import { applyIndexSettings, tendersIndex } from "./lib/meili";
import { meiliSynonyms } from "./lib/synonyms";

// Full reindex: read every published tender from Supabase (the source of truth),
// (re)apply index settings + synonyms, and replace the Meilisearch documents.
// Runs at the end of each scrape and on a daily cron so status changes / deletes
// and the date-relative fields (deadline_ts, open_rank) stay fresh.
// addDocuments only ever upserts, so after re-adding we also DELETE any Meili
// docs whose id is no longer in the published set — otherwise unpublished or
// deleted tenders would linger in search forever.
// `posted_at` (migration 0023) is selected so published_ts prefers the true
// source posting date over published_on/published_date.
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
  const liveIds = new Set<string>(); // ids that SHOULD be in the index
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("tenders")
      .select(COLS)
      .eq("status", "published")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`reindex fetch failed: ${error.message}`);
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    if (rows.length === 0) break;
    const docs = rows.map((r) => {
      const joins = (r.tender_categories as { category_id: number }[] | null) ?? [];
      const ids = joins.map((tc) => tc.category_id);
      if (ids.length === 0 && r.category_id != null) ids.push(r.category_id as number);
      return toSearchDoc({ ...r, category_ids: ids } as never, now);
    });
    for (const d of docs) liveIds.add(String(d.id));
    await idx.addDocuments(docs, { primaryKey: "id" });
    total += docs.length;
    console.log(`  indexed ${total}…`);
    if (rows.length < pageSize) break;
  }

  // Delete docs Meili still holds that are no longer published (unpublished /
  // rejected / deleted since the last run). Page through the index's ids and
  // remove any not in the freshly-built live set.
  const stale: string[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await idx.getDocuments({ fields: ["id"], limit: pageSize, offset });
    const results = page.results as Array<{ id: string | number }>;
    if (results.length === 0) break;
    for (const doc of results) {
      const id = String(doc.id);
      if (!liveIds.has(id)) stale.push(id);
    }
    if (results.length < pageSize) break;
  }
  if (stale.length > 0) {
    await idx.deleteDocuments(stale);
    console.log(`  removed ${stale.length} stale document(s).`);
  }

  console.log(`Reindex complete: ${total} documents, ${stale.length} removed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
