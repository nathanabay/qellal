// The normalized shape every scraper produces. Maps 1:1 to the columns a
// scraper is allowed to write on the `tenders` table. `category_id`, `status`
// and `created_by` are set by the upsert layer, never by a source.
export type TenderInput = {
  title: string;
  description: string | null;
  region: string | null;
  publishing_entity: string | null;
  published_date: string | null; // YYYY-MM-DD
  deadline: string; // YYYY-MM-DD — required by the schema
  source_name: string; // legal: attribution always
  source_url: string; // legal: link back to the original notice
  bid_bond: string | null; // e.g. "50,000" or "5% of bid price"
  bid_document_price: string | null; // cost to obtain the bid documents
  published_on: string | null; // source publication date, e.g. "Jul 15, 2026"
  // The tender's 2merkato category (its first one). The upsert layer creates
  // the category if new and resolves the slug to category_id.
  category_slug: string | null;
  category_name: string | null;
};
