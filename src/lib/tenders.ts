import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { normalizeSearch, searchOrClause } from "@/lib/search";
import type { TenderCardData } from "@/components/TenderCard";

// Business logic lives here, not in page components (project rule).

export type TendersResult =
  | { state: "not-configured" }
  | { state: "error"; message: string }
  | { state: "ok"; tenders: TenderCardData[] };

export type Category = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null; // null = top-level (matches 2merkato's tree)
};

export type TenderFilters = {
  q?: string; // keyword in title
  categoryId?: number;
  region?: string;
  deadlineInDays?: number; // deadline within N days from today
  openOnly?: boolean; // deadline not yet passed
  closedOnly?: boolean; // deadline passed
  bidBond?: boolean; // only tenders that state a bid bond
};

type GetOptions = {
  limit?: number;
  // "recent" = newest first (PRD default); "deadline" = soonest closing first.
  sort?: "recent" | "deadline";
  filters?: TenderFilters;
};

const COLUMNS =
  "id,title,region,deadline,published_date,published_on,source_name,publishing_entity,category_id,bid_bond,tender_categories(category_id)";

export async function getPublishedTenders(
  opts: GetOptions = {},
): Promise<TendersResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { state: "not-configured" };
  }

  const supabase = await createClient();
  const f = opts.filters ?? {};

  // Build a fresh, identically-ordered query per range fetch. A stable id
  // tiebreaker keeps ranges from skipping/duplicating rows across chunks.
  const today = new Date().toISOString().slice(0, 10);
  const build = () => {
    let query = supabase
      .from("tenders")
      .select(COLUMNS)
      .eq("status", "published");
    if (f.openOnly) query = query.gte("deadline", today);
    if (f.closedOnly) query = query.lt("deadline", today);
    const searchOr = f.q ? searchOrClause(normalizeSearch(f.q)) : null;
    if (searchOr) query = query.or(searchOr);
    if (f.categoryId) query = query.eq("category_id", f.categoryId);
    if (f.region) query = query.eq("region", f.region);
    if (f.bidBond) query = query.not("bid_bond", "is", null);
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
    return query.order("id", { ascending: true });
  };

  // PostgREST caps every response at 1000 rows, so page through in chunks up to
  // the requested limit to actually load the whole set.
  const hardLimit = opts.limit ?? 1000;
  const CHUNK = 1000;
  const rawAll: unknown[] = [];
  for (let from = 0; from < hardLimit; from += CHUNK) {
    const to = Math.min(from + CHUNK, hardLimit) - 1;
    const { data, error } = await build().range(from, to);
    if (error) {
      console.error("tenders fetch failed:", error.message);
      return { state: "error", message: error.message };
    }
    const batch = data ?? [];
    rawAll.push(...batch);
    if (batch.length < CHUNK) break; // reached the end
  }

  // Flatten the nested join into a category_ids array so the client can filter
  // by ANY of a tender's categories, not just its primary one.
  const rows = rawAll as Array<
    Record<string, unknown> & {
      category_id: number | null;
      tender_categories?: { category_id: number }[] | null;
    }
  >;
  return { state: "ok", tenders: flattenRows(rawAll) };
}

// Flatten the nested category join into a category_ids array so the client can
// filter by ANY of a tender's categories, not just its primary one.
function flattenRows(rawAll: unknown[]): TenderCardData[] {
  const rows = rawAll as Array<
    Record<string, unknown> & {
      category_id: number | null;
      tender_categories?: { category_id: number }[] | null;
    }
  >;
  return rows.map((r) => {
    const { tender_categories, ...rest } = r;
    const ids = (tender_categories ?? []).map((tc) => tc.category_id);
    if (ids.length === 0 && r.category_id != null) ids.push(r.category_id);
    return { ...rest, category_ids: ids } as unknown as TenderCardData;
  });
}

export type TendersPageResult =
  | { state: "not-configured" }
  | { state: "error"; message: string }
  | { state: "ok"; tenders: TenderCardData[]; total: number };

// Server-side single page of results with a total count — used for the
// Closed/All archive, which is far too large (thousands of rows) to preload and
// filter in the browser. Filters and sort run in Postgres; only `pageSize` rows
// come back per request.
export async function getPublishedTendersPage(opts: {
  filters?: TenderFilters;
  sort?: "recent" | "deadline";
  page?: number;
  pageSize?: number;
}): Promise<TendersPageResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { state: "not-configured" };

  const supabase = await createClient();
  const f = opts.filters ?? {};
  const today = new Date().toISOString().slice(0, 10);
  const pageSize = opts.pageSize ?? 24;
  const page = Math.max(1, opts.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Match ANY of a tender's categories (the many-to-many join), not just its
  // primary — parity with the open browser's client-side filtering. An inner
  // join on the filtered category makes the count reflect distinct tenders.
  const selectCols = f.categoryId
    ? COLUMNS.replace(
        "tender_categories(category_id)",
        "tender_categories!inner(category_id)",
      )
    : COLUMNS;

  let query = supabase
    .from("tenders")
    .select(selectCols, { count: "exact" })
    .eq("status", "published");
  if (f.openOnly) query = query.gte("deadline", today);
  if (f.closedOnly) query = query.lt("deadline", today);
  const searchOr = f.q ? searchOrClause(normalizeSearch(f.q)) : null;
  if (searchOr) query = query.or(searchOr);
  if (f.categoryId)
    query = query.eq("tender_categories.category_id", f.categoryId);
  if (f.region) query = query.eq("region", f.region);
  if (f.bidBond) query = query.not("bid_bond", "is", null);
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
  query = query.order("id", { ascending: true }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error("tenders page fetch failed:", error.message);
    return { state: "error", message: error.message };
  }
  return { state: "ok", tenders: flattenRows(data ?? []), total: count ?? 0 };
}

// Count of OPEN tenders (deadline not passed) — this is the "live" number the
// hero and CTA show, matching what /tenders defaults to. Head request only.
export async function getOpenTenderCount(): Promise<number | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return unstable_cache(
    async () => {
      const supabase = createAnonClient();
      const today = new Date().toISOString().slice(0, 10);
      const { count, error } = await supabase
        .from("tenders")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .gte("deadline", today);
      if (error) {
        console.error("open tender count failed:", error.message);
        return null;
      }
      return count ?? 0;
    },
    ["open-tender-count"],
    { revalidate: 3600 },
  )();
}

// Total published (open + closed) — used where the whole archive size matters.
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
  const { data: cats, error: cErr } = await supabase
    .from("categories")
    .select("id,name,slug,parent_id")
    .in("id", ids)
    .order("position", { nullsFirst: false })
    .order("name");
  if (cErr) {
    // parent_id may not be migrated yet (0022) — fall back so categories load.
    const { data: legacy } = await supabase
      .from("categories")
      .select("id,name,slug")
      .in("id", ids)
      .order("position", { nullsFirst: false })
      .order("name");
    return (legacy ?? []).map((c) => ({ ...c, parent_id: null }));
  }
  return (cats ?? []) as Category[];
}

export async function getCategories(): Promise<Category[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  return unstable_cache(
    async () => {
      const supabase = createAnonClient();
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,slug,parent_id")
        .order("position", { nullsFirst: false })
        .order("name");
      if (error) {
        // parent_id may not be migrated yet (0022) — fall back so the filter
        // dropdown and hubs still populate; parent_id reads as null until then.
        const { data: legacy, error: e2 } = await supabase
          .from("categories")
          .select("id,name,slug")
          .order("position", { nullsFirst: false })
          .order("name");
        if (e2) {
          console.error("categories fetch failed:", e2.message);
          return [];
        }
        return (legacy ?? []).map((c) => ({ ...c, parent_id: null }));
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
// The distinct set of regions changes ~never, but this scans the tenders table.
// Cache it for an hour (like getCategories) so it's off the per-request hot path
// (/tenders and /account previously ran this uncached on every load).
export async function getDistinctRegions(): Promise<string[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  return unstable_cache(
    async () => {
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
    },
    ["distinct-regions"],
    { revalidate: 3600 },
  )();
}
