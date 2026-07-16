import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import type { TenderCardData } from "@/components/TenderCard";

// Business logic lives here, not in page components (project rule).

export type TendersResult =
  | { state: "not-configured" }
  | { state: "error"; message: string }
  | { state: "ok"; tenders: TenderCardData[] };

export type Category = { id: number; name: string; slug: string };

export type TenderFilters = {
  q?: string; // keyword in title
  categoryId?: number;
  region?: string;
  deadlineInDays?: number; // deadline within N days from today
};

type GetOptions = {
  limit?: number;
  // "recent" = newest first (PRD default); "deadline" = soonest closing first.
  sort?: "recent" | "deadline";
  filters?: TenderFilters;
};

const COLUMNS =
  "id,title,region,deadline,published_date,source_name,publishing_entity,category_id,bid_bond,tender_categories(category_id)";

export async function getPublishedTenders(
  opts: GetOptions = {},
): Promise<TendersResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { state: "not-configured" };
  }

  const supabase = await createClient();
  let query = supabase
    .from("tenders")
    .select(COLUMNS)
    .eq("status", "published");

  const f = opts.filters ?? {};
  if (f.q) query = query.ilike("title", `%${f.q}%`);
  if (f.categoryId) query = query.eq("category_id", f.categoryId);
  if (f.region) query = query.eq("region", f.region);
  if (f.deadlineInDays) {
    const cutoff = new Date(Date.now() + f.deadlineInDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    query = query.lte("deadline", cutoff);
  }

  query =
    opts.sort === "deadline"
      ? query.order("deadline", { ascending: true })
      : query.order("published_date", { ascending: false });

  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) {
    console.error("tenders fetch failed:", error.message);
    return { state: "error", message: error.message };
  }
  // Flatten the nested join into a category_ids array so the client can filter
  // by ANY of a tender's categories, not just its primary one.
  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & {
      category_id: number | null;
      tender_categories?: { category_id: number }[] | null;
    }
  >;
  const tenders = rows.map((r) => {
    const { tender_categories, ...rest } = r;
    const ids = (tender_categories ?? []).map((tc) => tc.category_id);
    if (ids.length === 0 && r.category_id != null) ids.push(r.category_id);
    return { ...rest, category_ids: ids } as unknown as TenderCardData;
  });
  return { state: "ok", tenders };
}

// Lightweight count for the landing hero (head request, no rows transferred).
export async function getPublishedTenderCount(): Promise<number | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("tenders")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  if (error) {
    console.error("tender count failed:", error.message);
    return null;
  }
  return count ?? 0;
}

export type TenderDetail = {
  id: string;
  title: string;
  description: string | null;
  category_id: number | null;
  region: string | null;
  publishing_entity: string | null;
  published_date: string | null;
  deadline: string;
  source_name: string;
  source_url: string | null;
  bid_bond: string | null;
  bid_document_price: string | null;
  published_on: string | null;
};

// Single published tender by id. Returns null if missing, unpublished, or the
// id isn't a valid uuid (Postgres errors on bad uuid → treated as not found).
export async function getTenderById(id: string): Promise<TenderDetail | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenders")
    .select(
      "id,title,description,category_id,region,publishing_entity,published_date,deadline,source_name,source_url,bid_bond,bid_document_price,published_on",
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("tender fetch failed:", error.message);
    return null;
  }
  return data;
}

// All categories a tender is tagged with (via the tender_categories join).
export async function getTenderCategories(
  tenderId: string,
): Promise<Category[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  const supabase = await createClient();
  const { data: links, error } = await supabase
    .from("tender_categories")
    .select("category_id")
    .eq("tender_id", tenderId);
  if (error || !links || links.length === 0) return [];
  const ids = links.map((l) => l.category_id);
  const { data: cats } = await supabase
    .from("categories")
    .select("id,name,slug")
    .in("id", ids)
    .order("position", { nullsFirst: false })
    .order("name");
  return (cats ?? []) as Category[];
}

export async function getCategories(): Promise<Category[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  return unstable_cache(
    async () => {
      const supabase = createAnonClient();
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,slug")
        .order("position", { nullsFirst: false })
        .order("name");
      if (error) {
        console.error("categories fetch failed:", error.message);
        return [];
      }
      return data ?? [];
    },
    ["categories-all"],
    { revalidate: 3600 },
  )();
}

// Open-tender counts per category id and per region — powers the "Browse by
// sector / region" hub pages. Only small columns are fetched, so the payload
// stays light even with a large archive.
export type FacetCounts = {
  categories: Record<number, number>;
  regions: Record<string, number>;
};

export async function getOpenTenderFacetCounts(): Promise<FacetCounts> {
  const empty: FacetCounts = { categories: {}, regions: {} };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return empty;
  return unstable_cache(facetCountsUncached, ["open-facet-counts"], {
    revalidate: 3600,
  })();
}

async function facetCountsUncached(): Promise<FacetCounts> {
  const empty: FacetCounts = { categories: {}, regions: {} };
  const supabase = createAnonClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("tenders")
    .select("category_id,region,deadline,tender_categories(category_id)")
    .eq("status", "published")
    .gte("deadline", today); // open only

  if (error) {
    console.error("facet counts failed:", error.message);
    return empty;
  }
  const rows = (data ?? []) as unknown as {
    category_id: number | null;
    region: string | null;
    tender_categories?: { category_id: number }[] | null;
  }[];
  const categories: Record<number, number> = {};
  const regions: Record<string, number> = {};
  for (const r of rows) {
    // Count each open tender toward every category it belongs to (the join),
    // falling back to its primary category if there are no join rows yet.
    const ids = (r.tender_categories ?? []).map((tc) => tc.category_id);
    if (ids.length === 0 && r.category_id != null) ids.push(r.category_id);
    for (const id of ids) categories[id] = (categories[id] ?? 0) + 1;
    if (r.region) regions[r.region] = (regions[r.region] ?? 0) + 1;
  }
  return { categories, regions };
}

// Region is free-text on tenders — derive the filter options from the data
// that actually exists, so the dropdown is always accurate.
export async function getDistinctRegions(): Promise<string[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("tenders")
    .select("region")
    .eq("status", "published");

  if (error) {
    console.error("regions fetch failed:", error.message);
    return [];
  }
  const rows = (data ?? []) as { region: string | null }[];
  const set = new Set<string>();
  for (const row of rows) {
    if (row.region) set.add(row.region);
  }
  return [...set].sort();
}
