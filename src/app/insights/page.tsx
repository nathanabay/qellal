import Link from "next/link";
import { getMonthlyActivity, getTopEntities } from "@/lib/insights";
import { getCategories, getOpenTenderFacetCounts } from "@/lib/tenders";

// Insights data changes ~daily (scrape cadence); cache for an hour.
export const revalidate = 3600;

export const metadata = {
  title: "Tender market insights — Qellal",
  description:
    "Ethiopian tender activity by sector, region and month — plus the most active buyers.",
};

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(m) - 1] ?? m} ${y.slice(2)}`;
}

export default async function InsightsPage() {
  const [months, counts, categories, entities] = await Promise.all([
    getMonthlyActivity(12),
    getOpenTenderFacetCounts(),
    getCategories(),
    getTopEntities(6),
  ]);

  const monthMax = Math.max(1, ...months.map((m) => m.tender_count));
  const sectors = categories
    .map((c) => ({ name: c.name, slug: c.slug, open: counts.categories[c.id] ?? 0 }))
    .filter((s) => s.open > 0) // hide the ~160 empty sectors
    .sort((a, b) => b.open - a.open);
  const sectorMax = Math.max(1, ...sectors.map((s) => s.open));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>{" "}
        <span aria-hidden="true">/</span> Insights
      </nav>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Tender market insights
      </h1>
      <p className="mt-1 text-sm text-muted">
        Where the activity is — by month, sector and buyer. Built from the full
        archive, something 2merkato doesn&apos;t show you.
      </p>

      {/* Seasonality */}
      <section className="mt-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Tenders published per month</h2>
        {months.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Not enough history yet.</p>
        ) : (
          <div className="mt-3 flex items-end gap-1.5" style={{ height: "120px" }}>
            {months.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-primary"
                    style={{ height: `${(m.tender_count / monthMax) * 100}%` }}
                    title={`${m.tender_count} tenders`}
                  />
                </div>
                <span className="text-[10px] text-muted">{monthLabel(m.month)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sector activity */}
      <section className="mt-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Busiest sectors (open)
          </h2>
          <Link
            href="/categories"
            className="text-xs font-medium text-primary hover:underline"
          >
            All sectors →
          </Link>
        </div>
        <ul className="mt-3 space-y-2">
          {sectors.slice(0, 15).map((s) => (
            <li key={s.slug}>
              <Link
                href={`/tenders?category=${s.slug}`}
                className="block rounded-lg p-1 hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">{s.name}</span>
                  <span className="shrink-0 text-muted">{s.open}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(s.open / sectorMax) * 100}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Top buyers preview */}
      <section className="mt-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Most active buyers</h2>
          <Link href="/entities" className="text-xs font-medium text-primary hover:underline">
            See all →
          </Link>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {entities.map((e) => (
            <li key={e.entity} className="flex justify-between gap-3">
              <Link
                href={`/entities/${encodeURIComponent(e.entity)}`}
                className="min-w-0 truncate text-ink hover:text-primary"
              >
                {e.entity}
              </Link>
              <span className="shrink-0 text-muted">
                {e.tender_count} · {e.open_count} open
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
