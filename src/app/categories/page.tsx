import Link from "next/link";
import { getCategories, getOpenTenderFacetCounts } from "@/lib/tenders";

// Public aggregate page; cache for an hour (data updates ~daily).
export const revalidate = 3600;

export const metadata = {
  title: "Browse tenders by sector — Qellal",
  description: "Browse Ethiopian tenders by sector — construction, ICT, medical, and more.",
};

export default async function CategoriesPage() {
  const [categories, counts] = await Promise.all([
    getCategories(),
    getOpenTenderFacetCounts(),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>{" "}
        <span aria-hidden="true">/</span> Browse by sector
      </nav>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Browse by sector
      </h1>
      <p className="mt-1 text-sm text-muted">
        Jump straight to open tenders in your line of work.
      </p>

      {categories.length === 0 ? (
        <p className="mt-5 rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          No sectors to show yet.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categories.map((c) => {
            const open = counts.categories[c.id] ?? 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/tenders?category=${c.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="min-w-0 truncate font-medium text-ink">
                    {c.name}
                  </span>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-xs font-semibold text-ink tabular-nums">
                    {open} open
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
