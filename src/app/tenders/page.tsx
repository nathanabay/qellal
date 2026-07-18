import {
  getPublishedTendersPage,
  getCategories,
  getDistinctRegions,
} from "@/lib/tenders";
import { searchTenders, meiliConfigured, type SearchParams } from "@/lib/meili";
import { getSavedTenderIds } from "@/lib/saved";
import { createClient } from "@/lib/supabase/server";
import { TenderSearch } from "@/components/TenderSearch";
import { ScopeToggle } from "@/components/ScopeToggle";
import type { Scope } from "@/components/TenderFilters";
import type { TenderCardData } from "@/components/TenderCard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export const metadata = {
  title: "Browse tenders — Qellal",
  description: "All published Ethiopian tender notices, newest first.",
};

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

type Facets = { category_ids: Record<string, number>; region: Record<string, number> };

export default async function TendersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const scope: Scope =
    sp.scope === "closed" || sp.scope === "all" ? sp.scope : "open";

  const [categories, regions] = await Promise.all([
    getCategories(),
    getDistinctRegions(),
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const savedIds = user ? [...(await getSavedTenderIds())] : [];

  const category = str(sp.category);
  const deadline = str(sp.deadline);
  const q = str(sp.q);
  const sort = sp.sort === "recent" ? "recent" : "deadline";
  const pageNum = Math.max(1, Number(str(sp.page)) || 1);
  const categoryId = category
    ? (categories.find((c) => c.slug === category)?.id ?? undefined)
    : undefined;

  const params: SearchParams = {
    q: q || undefined,
    scope,
    categoryId,
    region: str(sp.region) || undefined,
    deadline: deadline === "7" || deadline === "30" ? deadline : "",
    bidBond: sp.bidBond === "1",
    sort,
    page: pageNum,
  };

  // Meilisearch is the primary backend (typo-tolerant, faceted, fast). On any
  // error it falls back to the Postgres query so /tenders never goes dark.
  let hits: TenderCardData[] = [];
  let total = 0;
  let facets: Facets = { category_ids: {}, region: {} };
  let errored = false;

  if (meiliConfigured()) {
    try {
      const r = await searchTenders(params);
      hits = r.hits;
      total = r.total;
      facets = r.facets;
    } catch (e) {
      const err = e as Error & { cause?: { code?: string } };
      // Explicit, grep-able line in Vercel logs so the cause is obvious:
      // AbortError=timeout, ENOTFOUND=DNS, ECONNREFUSED/ETIMEDOUT=network.
      console.error(
        `[meili] search failed → postgres fallback | name=${err?.name} code=${err?.cause?.code ?? ""} msg=${err?.message}`,
      );
      errored = true;
    }
  }
  if (!meiliConfigured() || errored) {
    const r = await getPublishedTendersPage({
      filters: {
        openOnly: scope === "open",
        closedOnly: scope === "closed",
        q: q || undefined,
        categoryId,
        region: str(sp.region) || undefined,
        deadlineInDays: deadline === "7" ? 7 : deadline === "30" ? 30 : undefined,
        bidBond: sp.bidBond === "1",
      },
      sort,
      page: pageNum,
      pageSize: PAGE_SIZE,
    });
    if (r.state === "ok") {
      hits = r.tenders;
      total = r.total;
    }
  }

  // Map Meili's id-keyed category facet counts to the slug-keyed shape the filter
  // dropdown expects; region facets are already keyed by name.
  const categoryCounts: Record<string, number> = {};
  for (const c of categories) {
    const n = facets.category_ids[String(c.id)];
    if (n) categoryCounts[c.slug] = n;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-5">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Tenders
        </h1>
        <p className="mt-1 text-sm text-muted">
          Search, filter, and save any search as an alert.
        </p>
        <nav className="mt-3 flex flex-wrap gap-2 text-sm">
          <a
            href="/categories"
            className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 font-medium text-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Browse by sector
          </a>
          <a
            href="/regions"
            className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 font-medium text-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Browse by region
          </a>
          <a
            href="/insights"
            className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 font-medium text-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Insights
          </a>
        </nav>
        <div className="mt-4">
          <ScopeToggle scope={scope} />
        </div>
      </header>

      <TenderSearch
        tenders={hits}
        total={total}
        page={pageNum}
        pageSize={PAGE_SIZE}
        scope={scope}
        categories={categories}
        regions={regions}
        categoryCounts={categoryCounts}
        regionCounts={facets.region}
        isLoggedIn={Boolean(user)}
        savedIds={savedIds}
      />
    </main>
  );
}
