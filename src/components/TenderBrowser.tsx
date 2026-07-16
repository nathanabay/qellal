"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TenderCard, type TenderCardData } from "./TenderCard";
import { TenderFilters, type FilterState, type Scope } from "./TenderFilters";
import type { Category } from "@/lib/tenders";
import { daysLeft } from "@/lib/format";
import { createAlertFromSearch } from "@/app/tenders/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { BellIcon } from "@/components/ui/icons";

const PAGE_SIZE = 24;

// Filters the already-loaded list instantly (no server round-trip per tweak),
// syncing to the URL so results stay shareable. Adds scope (open/closed/all),
// facet counts, removable chips, sort, and pagination.
export function TenderBrowser({
  tenders,
  categories,
  regions,
  isLoggedIn,
  savedIds = [],
}: {
  tenders: TenderCardData[];
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
    scope: (searchParams.get("scope") as Scope) || "open",
    category: searchParams.get("category") ?? "",
    region: searchParams.get("region") ?? "",
    deadline: searchParams.get("deadline") ?? "",
    bidBond: searchParams.get("bidBond") === "1",
    sort: searchParams.get("sort") === "recent" ? "recent" : "deadline",
  });
  const [page, setPage] = useState(() =>
    Math.max(1, Number(searchParams.get("page")) || 1),
  );

  const update = useCallback(
    (patch: Partial<FilterState>) => setF((prev) => ({ ...prev, ...patch })),
    [],
  );

  const idToSlug = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of categories) m.set(c.id, c.slug);
    return m;
  }, [categories]);
  const catId = useMemo(
    () => categories.find((c) => c.slug === f.category)?.id ?? null,
    [f.category, categories],
  );

  const maxDays = f.deadline === "7" ? 7 : f.deadline === "30" ? 30 : null;
  const matchScope = useCallback(
    (t: TenderCardData) => {
      if (f.scope === "all") return true;
      const open = daysLeft(t.deadline) > 0;
      return f.scope === "open" ? open : !open;
    },
    [f.scope],
  );

  // Base set for facet counts: scope + keyword only.
  const scoped = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return tenders.filter(
      (t) => matchScope(t) && (!q || t.title.toLowerCase().includes(q)),
    );
  }, [tenders, f.q, matchScope]);

  const passesRegion = (t: TenderCardData) => !f.region || t.region === f.region;
  const passesDeadline = (t: TenderCardData) =>
    maxDays === null || daysLeft(t.deadline) <= maxDays;
  const passesBidBond = (t: TenderCardData) => !f.bidBond || Boolean(t.bid_bond);
  // A tender matches a category if ANY of its categories match (the many-to-many
  // join), falling back to the primary category_id.
  const tenderCatIds = (t: TenderCardData) =>
    t.category_ids?.length
      ? t.category_ids
      : t.category_id != null
        ? [t.category_id]
        : [];
  const passesCategory = (t: TenderCardData) =>
    !f.category || (catId != null && tenderCatIds(t).includes(catId));

  // Counts reflect all OTHER active facets (so each is "what you'd get").
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of scoped) {
      if (!passesRegion(t) || !passesDeadline(t) || !passesBidBond(t)) continue;
      // Count a tender toward every category it belongs to.
      for (const id of tenderCatIds(t)) {
        const slug = idToSlug.get(id);
        if (slug) m[slug] = (m[slug] ?? 0) + 1;
      }
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, f.region, f.deadline, f.bidBond, idToSlug]);

  const regionCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of scoped) {
      if (!passesCategory(t) || !passesDeadline(t) || !passesBidBond(t))
        continue;
      if (t.region) m[t.region] = (m[t.region] ?? 0) + 1;
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, f.category, f.deadline, f.bidBond, catId]);

  const scopeTotal = useMemo(
    () =>
      scoped.filter(
        (t) => passesRegion(t) && passesDeadline(t) && passesBidBond(t),
      ).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, f.region, f.deadline, f.bidBond],
  );

  const filtered = useMemo(() => {
    const list = scoped.filter(
      (t) =>
        passesCategory(t) &&
        passesRegion(t) &&
        passesDeadline(t) &&
        passesBidBond(t),
    );
    list.sort((a, b) =>
      f.sort === "recent"
        ? (b.published_date ?? "").localeCompare(a.published_date ?? "")
        : a.deadline.localeCompare(b.deadline),
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, f.category, f.region, f.deadline, f.bidBond, f.sort, catId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // Reset to page 1 whenever the filters change (but keep a deep-linked page on
  // first mount).
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) setPage(1);
    else mounted.current = true;
  }, [f]);

  // Keep the URL in sync (debounced) so any view is a shareable link.
  useEffect(() => {
    const timer = setTimeout(() => {
      const p = new URLSearchParams();
      if (f.q) p.set("q", f.q);
      if (f.scope !== "open") p.set("scope", f.scope);
      if (f.category) p.set("category", f.category);
      if (f.region) p.set("region", f.region);
      if (f.deadline) p.set("deadline", f.deadline);
      if (f.bidBond) p.set("bidBond", "1");
      if (f.sort !== "deadline") p.set("sort", f.sort);
      if (safePage > 1) p.set("page", String(safePage));
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [f, safePage, pathname, router]);

  const catName = (slug: string) =>
    categories.find((c) => c.slug === slug)?.name ?? slug;

  const chips: { label: string; clear: () => void }[] = [];
  if (f.scope !== "open")
    chips.push({
      label: f.scope === "closed" ? "Closed" : "All statuses",
      clear: () => update({ scope: "open" }),
    });
  if (f.q) chips.push({ label: `“${f.q}”`, clear: () => update({ q: "" }) });
  if (f.category)
    chips.push({
      label: catName(f.category),
      clear: () => update({ category: "" }),
    });
  if (f.region)
    chips.push({ label: f.region, clear: () => update({ region: "" }) });
  if (f.deadline)
    chips.push({
      label: `Closing in ${f.deadline} days`,
      clear: () => update({ deadline: "" }),
    });
  if (f.bidBond)
    chips.push({ label: "Bid bond", clear: () => update({ bidBond: false }) });

  const hasFilters = chips.length > 0;
  const clearAll = () =>
    setF({
      q: "",
      scope: "open",
      category: "",
      region: "",
      deadline: "",
      bidBond: false,
      sort: f.sort,
    });

  return (
    <>
      <TenderFilters
        value={f}
        onChange={update}
        categories={categories}
        regions={regions}
        categoryCounts={categoryCounts}
        regionCounts={regionCounts}
        scopeTotal={scopeTotal}
      />

      {/* Applied-filter chips — stay visible so context is never lost. */}
      {hasFilters && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.clear}
              className="inline-flex min-h-[28px] items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary hover:bg-primary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Remove filter ${c.label}`}
            >
              {c.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {filtered.length} {filtered.length === 1 ? "tender" : "tenders"}
          {hasFilters ? " match" : ""}
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

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          {f.scope === "open"
            ? "No open tenders match — try “All” status or removing a filter."
            : "No tenders match — try removing a filter."}
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {pageItems.map((t) => (
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
                disabled={safePage <= 1}
                onClick={() => {
                  setPage(safePage - 1);
                  window.scrollTo({ top: 0 });
                }}
                className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-ink disabled:opacity-40 hover:enabled:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                ← Previous
              </button>
              <span className="text-sm text-muted">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => {
                  setPage(safePage + 1);
                  window.scrollTo({ top: 0 });
                }}
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
