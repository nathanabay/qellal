import { Meilisearch as MeiliSearch, type Index } from "meilisearch";
import type { SearchDoc } from "./search-doc";

const INDEX = "tenders";

let client: MeiliSearch | null = null;
export function getMeili(): MeiliSearch {
  const host = process.env.MEILI_HOST;
  const apiKey = process.env.MEILI_ADMIN_KEY;
  if (!host || !apiKey) throw new Error("MEILI_HOST and MEILI_ADMIN_KEY required");
  // TLS verification stays ON. For the interim self-signed cert (bare IP, no
  // domain), trust Caddy's root CA via NODE_EXTRA_CA_CERTS in the environment —
  // NOT by disabling verification (which would also weaken Supabase/Chapa TLS).
  // Once a domain + public Let's Encrypt cert exist, no extra CA is needed.
  if (!client) client = new MeiliSearch({ host, apiKey });
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
