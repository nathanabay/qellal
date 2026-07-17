"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TenderCard, type TenderCardData } from "./TenderCard";
import { TenderFilters, type FilterState, type Scope } from "./TenderFilters";
import type { Category } from "@/lib/tenders";
import { createAlertFromSearch } from "@/app/tenders/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { BellIcon } from "@/components/ui/icons";

// Single server-driven browser for ALL scopes (open / closed / all), backed by
// Meilisearch. Renders one page; filter/sort changes become debounced URL
// navigations that re-run the search server-side. Facet counts come from Meili's
// facetDistribution (so the dropdowns show live numbers in every scope).
export function TenderSearch({
  tenders,
  total,
  page,
  pageSize,
  scope,
  categories,
  regions,
  categoryCounts,
  regionCounts,
  isLoggedIn,
  savedIds = [],
}: {
  tenders: TenderCardData[];
  total: number;
  page: number;
  pageSize: number;
  scope: Scope;
  categories: Category[];
  regions: string[];
  categoryCounts: Record<string, number>;
  regionCounts: Record<string, number>;
  isLoggedIn: boolean;
  savedIds?: string[];
}) {
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [f, setF] = useState<FilterState>({
    q: searchParams.get("q") ?? "",
    category: searchParams.get("category") ?? "",
    region: searchParams.get("region") ?? "",
    deadline: searchParams.get("deadline") ?? "",
    bidBond: searchParams.get("bidBond") === "1",
    sort: searchParams.get("sort") === "recent" ? "recent" : "deadline",
  });
  const update = useCallback(
    (patch: Partial<FilterState>) => setF((prev) => ({ ...prev, ...patch })),
    [],
  );

  // Filter/sort change → server refetch (page resets to 1), debounced so typing
  // in the search box doesn't fire a request per keystroke.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = setTimeout(() => {
      const p = new URLSearchParams();
      if (scope !== "open") p.set("scope", scope);
      if (f.q) p.set("q", f.q);
      if (f.category) p.set("category", f.category);
      if (f.region) p.set("region", f.region);
      if (f.deadline) p.set("deadline", f.deadline);
      if (f.bidBond) p.set("bidBond", "1");
      if (f.sort !== "deadline") p.set("sort", f.sort);
      const qs = p.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 350);
    return () => clearTimeout(timer);
  }, [f, scope, pathname, router]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const gotoPage = (n: number) => {
    const p = new URLSearchParams(searchParams.toString());
    if (n > 1) p.set("page", String(n));
    else p.delete("page");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
    window.scrollTo({ top: 0 });
  };

  const hasFilters =
    Boolean(f.q || f.category || f.region || f.deadline || f.bidBond);

  return (
    <>
      <TenderFilters
        value={f}
        onChange={update}
        categories={categories}
        regions={regions}
        categoryCounts={categoryCounts}
        regionCounts={regionCounts}
        scopeTotal={f.category ? undefined : total}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted tabular-nums" role="status" aria-live="polite">
          {total.toLocaleString()} {total === 1 ? "tender" : "tenders"}
          {scope === "closed" ? " (closed)" : ""}
        </p>
        {hasFilters &&
          (isLoggedIn ? (
            <form action={createAlertFromSearch}>
              <input type="hidden" name="q" value={f.q} />
              <input type="hidden" name="category" value={f.category} />
              <input type="hidden" name="region" value={f.region} />
              <SubmitButton pendingText="Saving…">
                <BellIcon />
                Get alerts for this search
              </SubmitButton>
            </form>
          ) : (
            <a
              href="/login"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-medium text-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Sign in to get alerts
            </a>
          ))}
      </div>

      {hasFilters && f.q && (
        <p className="-mt-2 mb-4 text-xs text-muted">
          Heads up: alerts use smart matching — they also catch related terms and
          text inside the tender body, so an alert can be broader than this list.
        </p>
      )}

      {tenders.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          No tenders match — try removing a filter or switching status.
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {tenders.map((t) => (
              <li key={t.id}>
                <TenderCard
                  tender={t}
                  showSave
                  isLoggedIn={isLoggedIn}
                  saved={savedSet.has(t.id)}
                />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav
              className="mt-6 flex items-center justify-between gap-3"
              aria-label="Pagination"
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => gotoPage(page - 1)}
                className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-ink disabled:opacity-40 hover:enabled:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                ← Previous
              </button>
              <span className="text-sm text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => gotoPage(page + 1)}
                className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-ink disabled:opacity-40 hover:enabled:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
