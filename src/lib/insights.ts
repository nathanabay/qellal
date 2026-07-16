import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import type { TenderCardData } from "@/components/TenderCard";

// Market intelligence over the historical archive. Publication-stage only —
// no award/winner data — so these describe tendering activity, not outcomes.
// Uses the cookie-less anon client so the pages can be ISR-cached.

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
  return unstable_cache(
    async () => {
      const supabase = createAnonClient();
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
    },
    ["top-entities", String(limit)],
    { revalidate: 3600 },
  )();
}

export type EntityProfile = {
  stat: EntityStat | null;
  tenders: TenderCardData[]; // recent/open for display
  sectorCounts: Record<number, number>; // category_id → count, over ALL tenders
  regionCounts: Record<string, number>;
  sectorCount: number; // distinct sectors
};

export async function getEntityProfile(entity: string): Promise<EntityProfile> {
  const empty: EntityProfile = {
    stat: null,
    tenders: [],
    sectorCounts: {},
    regionCounts: {},
    sectorCount: 0,
  };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return empty;
  const supabase = createAnonClient();
  const [statRes, displayRes, breakdownRes] = await Promise.all([
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
    // Breakdown over ALL of the entity's tenders, via the many-to-many join.
    supabase
      .from("tenders")
      .select("region,tender_categories(category_id)")
      .eq("status", "published")
      .eq("publishing_entity", entity),
  ]);

  const sectorCounts: Record<number, number> = {};
  const regionCounts: Record<string, number> = {};
  const rows = (breakdownRes.data ?? []) as unknown as {
    region: string | null;
    tender_categories?: { category_id: number }[] | null;
  }[];
  for (const r of rows) {
    for (const tc of r.tender_categories ?? [])
      sectorCounts[tc.category_id] = (sectorCounts[tc.category_id] ?? 0) + 1;
    if (r.region) regionCounts[r.region] = (regionCounts[r.region] ?? 0) + 1;
  }

  return {
    stat: (statRes.data as EntityStat | null) ?? null,
    tenders: (displayRes.data ?? []) as TenderCardData[],
    sectorCounts,
    regionCounts,
    sectorCount: Object.keys(sectorCounts).length,
  };
}

// "Similar tenders" — shares ANY of the given categories (the many-to-many
// join), open ones first, most recent. Excludes the current tender.
export async function getSimilarTenders(
  categoryIds: number[],
  excludeId: string,
  limit = 5,
): Promise<TenderCardData[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || categoryIds.length === 0)
    return [];
  const supabase = createAnonClient();
  const { data: links } = await supabase
    .from("tender_categories")
    .select("tender_id")
    .in("category_id", categoryIds)
    .limit(400);
  const ids = [...new Set((links ?? []).map((l) => l.tender_id))]
    .filter((id) => id !== excludeId)
    .slice(0, 200);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("tenders")
    .select(CARD_COLS)
    .in("id", ids)
    .eq("status", "published")
    .order("published_date", { ascending: false })
    .limit(40);
  if (error) {
    console.error("similar tenders failed:", error.message);
    return [];
  }
  const rows = (data ?? []) as TenderCardData[];
  const today = new Date().toISOString().slice(0, 10);
  const open = rows.filter((t) => t.deadline >= today);
  const closed = rows.filter((t) => t.deadline < today);
  return [...open, ...closed].slice(0, limit);
}

export type MonthActivity = { month: string; tender_count: number };

// A contiguous last-`months` calendar window ending at the latest data month,
// with quiet months filled to 0 — so the x-axis is a true timeline.
export async function getMonthlyActivity(months = 12): Promise<MonthActivity[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  return unstable_cache(
    () => monthlyActivityUncached(months),
    ["monthly-activity", String(months)],
    { revalidate: 3600 },
  )();
}

async function monthlyActivityUncached(
  months: number,
): Promise<MonthActivity[]> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("monthly_activity")
    .select("month,tender_count")
    .order("month", { ascending: false })
    .limit(120);
  if (error) {
    console.error("monthly activity failed:", error.message);
    return [];
  }
  const rows = (data ?? []) as MonthActivity[];
  if (rows.length === 0) return [];
  const byMonth = new Map(rows.map((r) => [r.month, r.tender_count]));
  const latest = rows.map((r) => r.month).sort().at(-1)!; // "YYYY-MM"
  const [y, m] = latest.split("-").map(Number);
  const out: MonthActivity[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({ month: key, tender_count: byMonth.get(key) ?? 0 });
  }
  return out;
}
