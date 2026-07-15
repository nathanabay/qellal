"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/tenders";

type Props = {
  categories: Category[];
  regions: string[];
};

const selectClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink";

export function TenderFilters({ categories, regions }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Keyword is a controlled input with a debounce so we don't push on every key.
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const firstRender = useRef(true);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // replace (not push) so typing doesn't spam browser history.
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Debounced keyword → URL.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => setParam("q", q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const category = searchParams.get("category") ?? "";
  const region = searchParams.get("region") ?? "";
  const deadline = searchParams.get("deadline") ?? "";
  const hasFilters = Boolean(q || category || region || deadline);

  return (
    <div className="mb-5 rounded-xl border border-border bg-surface p-3">
      <input
        type="search"
        inputMode="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search tenders by title…"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted"
        aria-label="Search tenders by title"
      />

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          value={category}
          onChange={(e) => setParam("category", e.target.value)}
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
          value={region}
          onChange={(e) => setParam("region", e.target.value)}
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
          value={deadline}
          onChange={(e) => setParam("deadline", e.target.value)}
          className={selectClass}
          aria-label="Filter by deadline"
        >
          <option value="">Any deadline</option>
          <option value="7">Closing in 7 days</option>
          <option value="30">Closing in 30 days</option>
        </select>
      </div>

      {hasFilters && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setQ("");
              router.replace(pathname, { scroll: false });
            }}
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
