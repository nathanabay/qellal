import { getSupabase } from "./lib/supabase";
import { toSearchDoc } from "./lib/search-doc";
import { applyIndexSettings, tendersIndex } from "./lib/meili";
import { meiliSynonyms } from "./lib/synonyms";

// Full reindex: read every published tender from Supabase (the source of truth),
// (re)apply index settings + synonyms, and replace the Meilisearch documents.
// Runs at the end of each scrape and on a daily cron so status changes / deletes
// and the date-relative fields (deadline_ts, open_rank) stay fresh.
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
    await idx.addDocuments(docs, { primaryKey: "id" });
    total += docs.length;
    console.log(`  indexed ${total}…`);
    if (rows.length < pageSize) break;
  }
  console.log(`Reindex complete: ${total} documents.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
