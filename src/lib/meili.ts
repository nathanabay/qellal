import { Meilisearch } from "meilisearch";
import type { TenderCardData } from "@/components/TenderCard";

export type SearchParams = {
  q?: string;
  scope?: "open" | "closed" | "all";
  categoryId?: number;
  region?: string;
  deadline?: "" | "7" | "30";
  bidBond?: boolean;
  sort?: "recent" | "deadline";
  page?: number;
};

export function buildFilter(p: SearchParams, todayStart: number): string[] {
  const f: string[] = [];
  if (p.scope === "open") f.push(`deadline_ts >= ${todayStart}`);
  else if (p.scope === "closed") f.push(`deadline_ts < ${todayStart}`);
  if (p.categoryId) f.push(`category_ids = ${p.categoryId}`);
  if (p.region) f.push(`region = "${p.region.replace(/"/g, '\\"')}"`);
  if (p.bidBond) f.push(`has_bid_bond = true`);
  if (p.deadline === "7" || p.deadline === "30") {
    f.push(`deadline_ts <= ${todayStart + Number(p.deadline) * 86400}`);
  }
  return f;
}

export function buildSort(sort: "recent" | "deadline" | undefined): string[] {
  return sort === "recent"
    ? ["open_rank:asc", "published_ts:desc"]
    : ["open_rank:asc", "deadline_ts:asc"];
}

export type SearchResult = {
  hits: TenderCardData[];
  total: number;
  page: number;
  pageSize: number;
  facets: { category_ids: Record<string, number>; region: Record<string, number> };
};

// TLS verification stays ON. For the interim self-signed cert, trust Caddy's CA
// via NODE_EXTRA_CA_CERTS in the environment (NOT by disabling verification).
let client: Meilisearch | null = null;
function getClient(): Meilisearch {
  if (!client) {
    client = new Meilisearch({
      host: process.env.MEILI_HOST!,
      apiKey: process.env.MEILI_SEARCH_KEY!,
      // Fail fast if Meili is unreachable so the page falls back to Postgres
      // instead of hanging. 4s gives Vercel's cross-continent serverless a cold
      // TLS handshake margin while still failing fast when Meili is truly down.
      timeout: 4000,
    });
  }
  return client;
}

export function meiliConfigured(): boolean {
  return Boolean(process.env.MEILI_HOST && process.env.MEILI_SEARCH_KEY);
}

// One page of results + facet counts from Meilisearch. Throws on transport
// errors so the caller can fall back to Postgres.
export async function searchTenders(p: SearchParams): Promise<SearchResult> {
  const pageSize = 24;
  const page = Math.max(1, p.page ?? 1);
  const now = new Date();
  const todayStart = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000,
  );

  const res = await getClient().index("tenders").search(p.q ?? "", {
    filter: buildFilter(p, todayStart),
    sort: buildSort(p.sort),
    facets: ["category_ids", "region"],
    page,
    hitsPerPage: pageSize,
  });

  const hits = (res.hits as Array<Record<string, unknown>>).map((d) => {
    const ids = (d.category_ids as number[]) ?? [];
    return {
      id: d.id,
      title: d.title,
      region: d.region,
      deadline: d.deadline,
      source_name: d.source_name,
      publishing_entity: d.publishing_entity,
      category_id: ids[0] ?? null,
      category_ids: ids,
      bid_bond: d.bid_bond,
      published_date: null,
      published_on: d.published_on,
    } as unknown as TenderCardData;
  });

  const dist = (res.facetDistribution ?? {}) as Record<string, Record<string, number>>;
  const withTotal = res as unknown as { totalHits?: number; estimatedTotalHits?: number };
  return {
    hits,
    total: withTotal.totalHits ?? withTotal.estimatedTotalHits ?? hits.length,
    page,
    pageSize,
    facets: {
      category_ids: dist.category_ids ?? {},
      region: dist.region ?? {},
    },
  };
}
