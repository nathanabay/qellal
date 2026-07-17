import "server-only";
import { Meilisearch } from "meilisearch";
import type { SearchDoc } from "@/lib/search-doc";

// Admin-side Meilisearch writes for keeping the index in sync when a staff
// member publishes or rejects a tender. TLS verification stays ON (the domain
// has a valid cert). Every call is non-fatal — a Meili outage must never break
// an admin action; the daily reindex reconciles.
function admin(): Meilisearch | null {
  const host = process.env.MEILI_HOST;
  const apiKey = process.env.MEILI_ADMIN_KEY;
  if (!host || !apiKey) return null;
  return new Meilisearch({ host, apiKey });
}

export async function indexTender(doc: SearchDoc): Promise<void> {
  try {
    await admin()?.index("tenders").addDocuments([doc], { primaryKey: "id" });
  } catch (e) {
    console.error("meili indexTender failed:", (e as Error).message);
  }
}

export async function removeTender(id: string): Promise<void> {
  try {
    await admin()?.index("tenders").deleteDocument(id);
  } catch (e) {
    console.error("meili removeTender failed:", (e as Error).message);
  }
}
