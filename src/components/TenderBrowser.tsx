"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TenderCard, type TenderCardData } from "./TenderCard";
import { TenderFilters, type FilterState } from "./TenderFilters";
import type { Category } from "@/lib/tenders";
import { normalizeSearch, tenderMatchesSearch } from "@/lib/search";
import { daysLeft } from "@/lib/format";
import { createAlertFromSearch } from "@/app/tenders/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { BellIcon } from "@/components/ui/icons";

const PAGE_SIZE = 24;

type View = {
  filtered: TenderCardData[];
  categoryCounts: Record<string, number>;
  regionCounts: Record<string, number>;
  scopeTotal: number;
};

// The source "Published on" date is free text like "Jul 16, 2026" — and may be a
// comma-joined list when a tender ran in several sources. Pull out every date
// token and use the most recent; fall back to the system published_date.
function publishedTs(t: TenderCardData): number {
  const raw = t.published_on ?? "";
  const tokens = raw.match(/[A-Za-z]{3,9}\.?\s+\d{1,2},\s*\d{4}/g);
  let best = -Infinity;
  for (const tok of tokens ?? []) {
    const ms = Date.parse(tok);
    if (!Number.isNaN(ms) && ms > best) best = ms;
  }
  if (best === -Infinity && t.published_date) {
    const ms = Date.parse(t.published_date);
    if (!Number.isNaN(ms)) best = ms;
  }
  return best === -Infinity ? 0 : best;
}

// Pure derivation of the visible list + per-facet counts for a given filter
// state. This browser only handles the preloaded OPEN set (scope is server-
// driven via ScopeToggle), so there's no open/closed filtering here.
function deriveView(
  tenders: TenderCardData[],
  f: FilterState,
  categories: Category[],
): View {
  const idToSlug = new Map<number, string>();
  for (const c of categories) idToSlug.set(c.id, c.slug);
  const catId = categories.find((c) => c.slug === f.category)?.id ?? null;
  const maxDays = f.deadline === "7" ? 7 : f.deadline === "30" ? 30 : null;

  const tenderCatIds = (t: TenderCardData) =>
    t.category_ids?.length
      ? t.category_ids
      : t.category_id != null
        ? [t.category_id]
        : [];
  const passesRegion = (t: TenderCardData) => !f.region || t.region === f.region;
  const passesDeadline = (t: TenderCardData) =>
    maxDays === null || daysLeft(t.deadline) <= maxDays;
  const passesBidBond = (t: TenderCardData) => !f.bidBond || Boolean(t.bid_bond);
  const passesCategory = (t: TenderCardData) =>
    !f.category || (catId != null && tenderCatIds(t).includes(catId));

  // Same normalization as the server (see @/lib/search) so Open and the archive
  // treat identical input identically. Matches title + buyer.
  const q = normalizeSearch(f.q).toLowerCase();
  const scoped = tenders.filter((t) => tenderMatchesSearch(t, q));

  // Counts reflect all OTHER active facets (so each is "what you'd get").
  const categoryCounts: Record<string, number> = {};
  for (const t of scoped) {
    if (!passesRegion(t) || !passesDeadline(t) || !passesBidBond(t)) continue;
    for (const id of tenderCatIds(t)) {
      const slug = idToSlug.get(id);
      if (slug) categoryCounts[slug] = (categoryCounts[slug] ?? 0) + 1;
    }
  }
  const regionCounts: Record<string, number> = {};
  for (const t of scoped) {
    if (!passesCategory(t) || !passesDeadline(t) || !passesBidBond(t)) continue;
    if (t.region) regionCounts[t.region] = (regionCounts[t.region] ?? 0) + 1;
  }
  const scopeTotal = scoped.filter(
    (t) => passesRegion(t) && passesDeadline(t) && passesBidBond(t),
  ).length;

  const passing = scoped.filter(
    (t) =>
      passesCategory(t) &&
      passesRegion(t) &&
      passesDeadline(t) &&
      passesBidBond(t),
  );

  // "Recently published" sorts by the source "Published on" date; "Deadline"
  // shows soonest-closing first. (All rows here are open, so no open/closed
  // ordering is needed.)
  const decorated = passing.map((t) => ({ t, pub: publishedTs(t) }));
  decorated.sort((a, b) =>
    f.sort === "recent"
      ? b.pub - a.pub
      : a.t.deadline.localeCompare(b.t.deadline),
  );
  const filtered = decorated.map((d) => d.t);

  return { filtered, categoryCounts, regionCounts, scopeTotal };
}

// Instant, client-side filtering over the preloaded OPEN tenders (a small set),
// synced to the URL so views are shareable. On mobile, filters live in a
// bottom-sheet tray with a batched "Show N results" apply.
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

  const view = useMemo(
    () => deriveView(tenders, f, categories),
    [tenders, f, categories],
  );
  const { filtered, categoryCounts, regionCounts, scopeTotal } = view;

  // Mobile tray: edits go to a draft; the list only updates on "Show results".
  const [trayOpen, setTrayOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(f);
  const draftView = useMemo(
    () => deriveView(tenders, draft, categories),
    [tenders, draft, categories],
  );
  const openTray = () => {
    setDraft(f);
    setTrayOpen(true);
  };
  const applyDraft = () => {
    setF(draft);
    setTrayOpen(false);
  };
  const updateDraft = useCallback(
    (patch: Partial<FilterState>) => setDraft((prev) => ({ ...prev, ...patch })),
    [],
  );

  useEffect(() => {
    if (!trayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTrayOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trayOpen]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

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
      category: "",
      region: "",
      deadline: "",
      bidBond: false,
      sort: f.sort,
    });

  return (
    <>
      {/* Desktop: filters inline and instant. */}
      <div className="hidden lg:block">
        <TenderFilters
          value={f}
          onChange={update}
          categories={categories}
          regions={regions}
          categoryCounts={categoryCounts}
          regionCounts={regionCounts}
          scopeTotal={scopeTotal}
        />
      </div>

      {/* Mobile: sticky trigger opens the filter tray. */}
      <div className="sticky top-14 z-20 -mx-4 mb-3 border-b border-border bg-canvas/95 px-4 py-2 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={openTray}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-haspopup="dialog"
          aria-expanded={trayOpen}
        >
          Filter &amp; sort
          {hasFilters && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
              {chips.length}
            </span>
          )}
        </button>
      </div>

      {trayOpen && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filter and sort tenders"
        >
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setTrayOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex max-h-[85vh] flex-col rounded-t-2xl bg-canvas shadow-[var(--shadow-lift)]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-heading text-base font-semibold text-ink">
                Filter &amp; sort
              </h2>
              <button
                type="button"
                onClick={() => setTrayOpen(false)}
                className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Close filters"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3">
              <TenderFilters
                value={draft}
                onChange={updateDraft}
                categories={categories}
                regions={regions}
                categoryCounts={draftView.categoryCounts}
                regionCounts={draftView.regionCounts}
                scopeTotal={draftView.scopeTotal}
              />
            </div>
            <div className="border-t border-border p-3">
              <button
                type="button"
                onClick={applyDraft}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Show {draftView.filtered.length}{" "}
                {draftView.filtered.length === 1 ? "result" : "results"}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <p className="text-sm text-muted tabular-nums" role="status" aria-live="polite">
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

      {f.q && (
        <p className="-mt-2 mb-4 text-xs text-muted">
          Heads up: alerts use smart matching — they also catch related terms and
          text inside the tender body, so an alert can be broader than this list.
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          No open tenders match — try “Closed” or “All”, or removing a filter.
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
