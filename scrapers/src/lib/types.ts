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
  posted_at: string | null; // precise 2merkato posting instant (ISO), from the
  // "Posted X ago" label / created_at — carries date AND time.
  // All 2merkato categories this tender is tagged with (first = primary). The
  // upsert layer creates any new category and writes the join rows.
  categories: { slug: string; name: string }[];
};

// One node of 2merkato's category taxonomy, in depth-first (parent-then-children)
// order. The upsert layer syncs these into `categories` so the stored hierarchy
// and ordering match 2merkato exactly after every scrape.
export type TaxonomyRow = {
  slug: string;
  name: string;
  parentSlug: string | null; // null = top-level category
  position: number; // 1-based depth-first order
};
