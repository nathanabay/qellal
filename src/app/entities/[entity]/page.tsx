import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntityProfile } from "@/lib/insights";
import { getCategories } from "@/lib/tenders";
import { TenderCard } from "@/components/TenderCard";
import { daysLeft } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ entity: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { entity } = await params;
  const name = decodeURIComponent(entity);
  return {
    title: `${name} — tenders & activity — Qellal`,
    description: `Tenders published by ${name}, with sector and region breakdown.`,
  };
}

export default async function EntityPage({ params }: { params: Params }) {
  const { entity } = await params;
  const name = decodeURIComponent(entity);
  const [{ stat, tenders }, categories] = await Promise.all([
    getEntityProfile(name),
    getCategories(),
  ]);
  if (!stat && tenders.length === 0) notFound();

  const openTenders = tenders.filter((t) => daysLeft(t.deadline) > 0);

  // Top sectors + regions this entity tenders in (from their tenders).
  const catName = (id: number | null) =>
    id == null ? null : (categories.find((c) => c.id === id)?.name ?? null);
  const tally = (values: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  };
  const topSectors = tally(tenders.map((t) => catName(t.category_id)));
  const topRegions = tally(tenders.map((t) => t.region));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/entities" className="hover:text-primary">
          Top buyers
        </Link>{" "}
        <span aria-hidden="true">/</span> {name}
      </nav>
      <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {name}
      </h1>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Total tenders", value: stat?.tender_count ?? tenders.length },
          { label: "Open now", value: stat?.open_count ?? openTenders.length },
          { label: "Sectors", value: topSectors.length },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-surface p-3 text-center"
          >
            <p className="font-heading text-2xl font-bold tabular-nums text-ink">
              {s.value}
            </p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {(topSectors.length > 0 || topRegions.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {topSectors.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Tenders by sector
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {topSectors.map(([n, c]) => (
                  <li key={n} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{n}</span>
                    <span className="shrink-0 text-muted">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {topRegions.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Tenders by region
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {topRegions.map(([n, c]) => (
                  <li key={n} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{n}</span>
                    <span className="shrink-0 text-muted">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
        {openTenders.length > 0
          ? `${openTenders.length} open tender${openTenders.length === 1 ? "" : "s"}`
          : "Recent tenders"}
      </h2>
      <ul className="mt-3 space-y-3">
        {(openTenders.length > 0 ? openTenders : tenders.slice(0, 10)).map(
          (t) => (
            <li key={t.id}>
              <TenderCard tender={t} />
            </li>
          ),
        )}
      </ul>
    </main>
  );
}
