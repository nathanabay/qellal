"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Scope } from "./TenderFilters";

const SCOPES: { value: Scope; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

// Scope is server-driven: "open" is the instant, fully-preloaded view; "closed"
// and "all" are the large archive, served one page at a time. So the toggle
// navigates (changing ?scope=) rather than filtering client-side. Other filters
// carry over; page resets.
export function ScopeToggle({ scope }: { scope: Scope }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = (value: Scope) => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("page");
    if (value === "open") p.delete("scope");
    else p.set("scope", value);
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div
      role="group"
      aria-label="Tender status"
      className="inline-flex rounded-lg border border-border p-0.5"
    >
      {SCOPES.map((s) => {
        const active = scope === s.value;
        return (
          <Link
            key={s.value}
            href={hrefFor(s.value)}
            aria-current={active ? "true" : undefined}
            scroll={false}
            className={`min-h-9 inline-flex items-center rounded-md px-3 text-sm font-medium transition-colors ${
              active ? "bg-ink text-canvas" : "text-ink hover:bg-canvas"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
