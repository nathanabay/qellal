"use client";

import type { Category } from "@/lib/tenders";

export type FilterState = {
  q: string;
  category: string; // category slug
  region: string;
  deadline: string; // "" | "7" | "30"
};

const selectClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink";

// Presentational, fully controlled — parent owns state & does the filtering.
export function TenderFilters({
  value,
  onChange,
  categories,
  regions,
}: {
  value: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  categories: Category[];
  regions: string[];
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
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          value={value.category}
          onChange={(e) => onChange({ category: e.target.value })}
          className={selectClass}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
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
              {r}
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
    </div>
  );
}
