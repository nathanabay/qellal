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
};
