import { createClient } from "@/lib/supabase/server";
import type { TenderCardData } from "@/components/TenderCard";

// Set of tender ids the current user has saved (empty if logged out). RLS scopes
// the query to the user's own rows.
export async function getSavedTenderIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("saved_tenders")
    .select("tender_id");
  if (error) {
    console.error("saved ids fetch failed:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.tender_id));
}

// Full saved tenders (card data) for the /account page, newest-save first.
export async function getSavedTenders(): Promise<TenderCardData[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: saves, error } = await supabase
    .from("saved_tenders")
    .select("tender_id")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("saved fetch failed:", error.message);
    return [];
  }
  const ids = (saves ?? []).map((s) => s.tender_id);
  if (ids.length === 0) return [];

  const { data: tenders } = await supabase
    .from("tenders")
    .select(
      "id,title,region,deadline,source_name,publishing_entity,category_id,bid_bond,published_on,published_date,tender_categories(category_id)",
    )
    .in("id", ids)
    .eq("status", "published");

  // Flatten the category join so saved cards show the bid-bond badge + category
  // chips like everywhere else.
  const rows = (tenders ?? []) as unknown as Array<
    Record<string, unknown> & {
      id: string;
      category_id: number | null;
      tender_categories?: { category_id: number }[] | null;
    }
  >;
  const byId = new Map(
    rows.map((r) => {
      const { tender_categories, ...rest } = r;
      const catIds = (tender_categories ?? []).map((tc) => tc.category_id);
      if (catIds.length === 0 && r.category_id != null) catIds.push(r.category_id);
      return [r.id, { ...rest, category_ids: catIds } as unknown as TenderCardData];
    }),
  );
  // Preserve the save order (most recently saved first).
  return ids.map((id) => byId.get(id)).filter(Boolean) as TenderCardData[];
}
