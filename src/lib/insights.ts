import { createClient } from "@/lib/supabase/server";
import type { TenderCardData } from "@/components/TenderCard";

// Market intelligence over the historical archive. Publication-stage only —
// no award/winner data — so these describe tendering activity, not outcomes.

const CARD_COLS =
  "id,title,region,deadline,published_date,source_name,publishing_entity,category_id,bid_bond";

export type EntityStat = {
  entity: string;
  tender_count: number;
  open_count: number;
  last_published: string | null;
};

export async function getTopEntities(limit = 40): Promise<EntityStat[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entity_stats")
    .select("entity,tender_count,open_count,last_published")
    .order("tender_count", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("top entities failed:", error.message);
    return [];
  }
  return (data ?? []) as EntityStat[];
}

export async function getEntityProfile(
  entity: string,
): Promise<{ stat: EntityStat | null; tenders: TenderCardData[] }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { stat: null, tenders: [] };
  const supabase = await createClient();
  const [statRes, tenderRes] = await Promise.all([
    supabase
      .from("entity_stats")
      .select("entity,tender_count,open_count,last_published")
      .eq("entity", entity)
      .maybeSingle(),
    supabase
      .from("tenders")
      .select(CARD_COLS)
      .eq("status", "published")
      .eq("publishing_entity", entity)
      .order("deadline", { ascending: false })
      .limit(50),
  ]);
  return {
    stat: (statRes.data as EntityStat | null) ?? null,
    tenders: (tenderRes.data ?? []) as TenderCardData[],
  };
}

// "Similar past tenders" — same category, most recent, excluding the current one.
export async function getSimilarTenders(
  categoryId: number | null,
  excludeId: string,
  limit = 5,
): Promise<TenderCardData[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || categoryId == null) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenders")
    .select(CARD_COLS)
    .eq("status", "published")
    .eq("category_id", categoryId)
    .neq("id", excludeId)
    .order("published_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("similar tenders failed:", error.message);
    return [];
  }
  return (data ?? []) as TenderCardData[];
}

export type MonthActivity = { month: string; tender_count: number };

export async function getMonthlyActivity(months = 12): Promise<MonthActivity[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_activity")
    .select("month,tender_count")
    .order("month", { ascending: false })
    .limit(months);
  if (error) {
    console.error("monthly activity failed:", error.message);
    return [];
  }
  return ((data ?? []) as MonthActivity[]).reverse();
}
