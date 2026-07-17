"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TenderCard, type TenderCardData } from "./TenderCard";
import { TenderFilters, type FilterState, type Scope } from "./TenderFilters";
import type { Category } from "@/lib/tenders";

// The Closed/All archive is thousands of rows — far too large to preload and
// filter in the browser. So it's paginated on the SERVER: this component renders
// one page and turns filter/sort changes into URL navigations (debounced), which
// re-run the query. Per-facet counts aren't computed here (they'd need extra
// aggregate queries); the dropdowns show labels without numbers.
export function ArchiveBrowser({
  tenders,
  total,
  page,
  pageSize,
  scope,
  categories,
  regions,
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
      p.set("scope", scope); // stay in the archive (closed/all)
      if (f.q) p.set("q", f.q);
      if (f.category) p.set("category", f.category);
      if (f.region) p.set("region", f.region);
      if (f.deadline) p.set("deadline", f.deadline);
      if (f.bidBond) p.set("bidBond", "1");
      if (f.sort !== "deadline") p.set("sort", f.sort);
      router.push(`${pathname}?${p.toString()}`, { scroll: false });
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

  return (
    <>
      <TenderFilters
        value={f}
        onChange={update}
        categories={categories}
        regions={regions}
        categoryCounts={{}}
        regionCounts={{}}
        scopeTotal={f.category ? undefined : total}
      />

      <div className="mb-4">
        <p className="text-sm text-muted tabular-nums" role="status" aria-live="polite">
          {total.toLocaleString()} {total === 1 ? "tender" : "tenders"}
          {scope === "closed" ? " (closed)" : ""}
        </p>
      </div>

      {tenders.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          No tenders match — try removing a filter.
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
