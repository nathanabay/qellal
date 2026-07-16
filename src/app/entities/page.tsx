import Link from "next/link";
import { entityHref } from "@/lib/entity";
import { getTopEntities } from "@/lib/insights";

// Public aggregate page; cache for an hour (data updates ~daily).
export const revalidate = 3600;

export const metadata = {
  title: "Most active procuring entities — Qellal",
  description:
    "Ethiopian organizations that publish the most tenders — banks, agencies, NGOs and more.",
};

export default async function EntitiesPage() {
  const entities = await getTopEntities(50);
  const max = entities[0]?.tender_count ?? 1;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>{" "}
        <span aria-hidden="true">/</span>{" "}
        <Link href="/insights" className="hover:text-primary">
          Insights
        </Link>{" "}
        <span aria-hidden="true">/</span> Top buyers
      </nav>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Most active procuring entities
      </h1>
      <p className="mt-1 text-sm text-muted">
        Who publishes the most tenders. Know the repeat buyers in your sector.
      </p>

      {entities.length === 0 ? (
        <p className="mt-5 rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          No data yet.
        </p>
      ) : (
        <ol className="mt-5 space-y-2">
          {entities.map((e, i) => (
            <li key={e.entity}>
              <Link
                href={entityHref(e.entity)}
                className="block rounded-xl border border-border bg-surface p-3 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-heading font-semibold text-ink">
                    <span className="font-mono text-muted">{i + 1}.</span>{" "}
                    {e.entity}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                    {e.tender_count} total ·{" "}
                    <span className="font-semibold text-ink">
                      {e.open_count} open
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(e.tender_count / max) * 100}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
