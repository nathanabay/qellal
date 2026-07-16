import Link from "next/link";
import { getDistinctRegions, getOpenTenderFacetCounts } from "@/lib/tenders";

// Public aggregate page; cache for an hour (data updates ~daily).
export const revalidate = 3600;

export const metadata = {
  title: "Browse tenders by region — Qellal",
  description: "Browse Ethiopian tenders by region — Addis Ababa, Oromia, Amhara, and more.",
};

export default async function RegionsPage() {
  const [regions, counts] = await Promise.all([
    getDistinctRegions(),
    getOpenTenderFacetCounts(),
  ]);

  // Show regions that actually have open tenders first, then the rest.
  const sorted = [...regions].sort(
    (a, b) => (counts.regions[b] ?? 0) - (counts.regions[a] ?? 0),
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>{" "}
        <span aria-hidden="true">/</span> Browse by region
      </nav>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Browse by region
      </h1>
      <p className="mt-1 text-sm text-muted">
        Find open tenders close to where you operate.
      </p>

      {sorted.length === 0 ? (
        <p className="mt-5 rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          No regions to show yet.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sorted.map((r) => (
            <li key={r}>
              <Link
                href={`/tenders?region=${encodeURIComponent(r)}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="min-w-0 truncate font-medium text-ink">{r}</span>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-xs font-semibold text-ink tabular-nums">
                  {counts.regions[r] ?? 0} open
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
