"use client";

import type { Category } from "@/lib/tenders";

export type Scope = "open" | "closed" | "all";
export type Sort = "deadline" | "recent";

export type FilterState = {
  q: string;
  scope: Scope; // open = deadline not passed; closed = passed; all = everything
  category: string; // category slug
  region: string;
  deadline: string; // "" | "7" | "30"
  bidBond: boolean; // only tenders that state a bid bond
  sort: Sort;
};

const selectClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink";

const SCOPES: { value: Scope; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

function withCount(label: string, n: number | undefined) {
  return n === undefined ? label : `${label} (${n})`;
}

// Presentational, fully controlled — parent owns state, filtering, and counts.
export function TenderFilters({
  value,
  onChange,
  categories,
  regions,
  categoryCounts,
  regionCounts,
  scopeTotal,
}: {
  value: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  categories: Category[];
  regions: string[];
  categoryCounts: Record<string, number>;
  regionCounts: Record<string, number>;
  scopeTotal: number;
}) {
  return (
    <div className="mb-4 rounded-xl border border-border bg-surface p-3">
      <input
        type="search"
        inputMode="search"
        value={value.q}
        onChange={(e) => onChange({ q: e.target.value })}
        placeholder="Search tenders by title…"
        aria-label="Search tenders by title"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted"
      />

      {/* Scope toggle (Active vs archive) — the most decision-driving control. */}
      <div
        role="group"
        aria-label="Tender status"
        className="mt-3 inline-flex rounded-lg border border-border p-0.5"
      >
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={value.scope === s.value}
            onClick={() => onChange({ scope: s.value })}
            className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${
              value.scope === s.value
                ? "bg-ink text-canvas"
                : "text-ink hover:bg-canvas"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          value={value.category}
          onChange={(e) => onChange({ category: e.target.value })}
          className={selectClass}
          aria-label="Filter by category"
        >
          <option value="">{withCount("All categories", scopeTotal)}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {withCount(c.name, categoryCounts[c.slug])}
            </option>
          ))}
        </select>
        <select
          value={value.region}
          onChange={(e) => onChange({ region: e.target.value })}
          className={selectClass}
          aria-label="Filter by region"
        >
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {withCount(r, regionCounts[r])}
            </option>
          ))}
        </select>
        <select
          value={value.deadline}
          onChange={(e) => onChange({ deadline: e.target.value })}
          className={selectClass}
          aria-label="Filter by deadline"
        >
          <option value="">Any deadline</option>
          <option value="7">Closing in 7 days</option>
          <option value="30">Closing in 30 days</option>
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={value.bidBond}
            onChange={(e) => onChange({ bidBond: e.target.checked })}
            className="h-4 w-4"
          />
          Requires bid bond
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-muted">
          Sort
          <select
            value={value.sort}
            onChange={(e) => onChange({ sort: e.target.value as Sort })}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            aria-label="Sort tenders"
          >
            <option value="deadline">Deadline (soonest)</option>
            <option value="recent">Recently published</option>
          </select>
        </label>
      </div>
    </div>
  );
}
