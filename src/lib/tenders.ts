import { createClient } from "@/lib/supabase/server";
import type { TenderCardData } from "@/components/TenderCard";

// Business logic lives here, not in page components (project rule).

export type TendersResult =
  | { state: "not-configured" }
  | { state: "error"; message: string }
  | { state: "ok"; tenders: TenderCardData[] };

type GetOptions = {
  limit?: number;
  // "recent" = newest first (PRD default); "deadline" = soonest closing first.
  sort?: "recent" | "deadline";
};

const COLUMNS = "id,title,region,deadline,source_name,publishing_entity";

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
  return { state: "ok", tenders: data ?? [] };
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
