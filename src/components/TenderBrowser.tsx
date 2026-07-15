"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TenderCard, type TenderCardData } from "./TenderCard";
import { TenderFilters, type FilterState } from "./TenderFilters";
import type { Category } from "@/lib/tenders";
import { daysLeft } from "@/lib/format";
import { createAlertFromSearch } from "@/app/tenders/actions";

// F11: filters the already-loaded list instantly (no server round-trip per tweak),
// while syncing to the URL so results stay shareable. SSR still renders the initial
// list, so first paint is fast on 3G.
export function TenderBrowser({
  tenders,
  categories,
  regions,
  isLoggedIn,
}: {
  tenders: TenderCardData[];
  categories: Category[];
  regions: string[];
  isLoggedIn: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [f, setF] = useState<FilterState>({
    q: searchParams.get("q") ?? "",
    category: searchParams.get("category") ?? "",
    region: searchParams.get("region") ?? "",
    deadline: searchParams.get("deadline") ?? "",
  });

  const update = useCallback(
    (patch: Partial<FilterState>) => setF((prev) => ({ ...prev, ...patch })),
    [],
  );

  const catId = useMemo(
    () => categories.find((c) => c.slug === f.category)?.id ?? null,
    [f.category, categories],
  );

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const maxDays = f.deadline === "7" ? 7 : f.deadline === "30" ? 30 : null;
    return tenders.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (f.category && t.category_id !== catId) return false;
      if (f.region && t.region !== f.region) return false;
      if (maxDays !== null && daysLeft(t.deadline) > maxDays) return false;
      return true;
    });
  }, [tenders, f, catId]);

  // Keep the URL in sync (debounced) so any filtered view is a shareable link.
  useEffect(() => {
    const timer = setTimeout(() => {
      const p = new URLSearchParams();
      if (f.q) p.set("q", f.q);
      if (f.category) p.set("category", f.category);
      if (f.region) p.set("region", f.region);
      if (f.deadline) p.set("deadline", f.deadline);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [f, pathname, router]);

  const hasFilters = Boolean(f.q || f.category || f.region || f.deadline);

  return (
    <>
      <TenderFilters
        value={f}
        onChange={update}
        categories={categories}
        regions={regions}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {filtered.length} {filtered.length === 1 ? "tender" : "tenders"}
          {hasFilters ? " match" : ""}
        </p>
        <div className="flex items-center gap-3">
          {hasFilters && (
            <button
              type="button"
              onClick={() =>
                setF({ q: "", category: "", region: "", deadline: "" })
              }
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              Clear
            </button>
          )}
          {/* F12: save this search as a recurring alert */}
          {hasFilters &&
            (isLoggedIn ? (
              <form action={createAlertFromSearch}>
                <input type="hidden" name="q" value={f.q} />
                <input type="hidden" name="category" value={f.category} />
                <input type="hidden" name="region" value={f.region} />
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-hover"
                >
                  🔔 Get alerts for this search
                </button>
              </form>
            ) : (
              <a
                href="/login"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-soft"
              >
                Sign in to get alerts
              </a>
            ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          No tenders match — try removing a filter.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((t) => (
            <li key={t.id}>
              <TenderCard tender={t} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
