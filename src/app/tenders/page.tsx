import {
  getPublishedTenders,
  getCategories,
  getDistinctRegions,
} from "@/lib/tenders";
import { TenderCard } from "@/components/TenderCard";
import { TenderFilters } from "@/components/TenderFilters";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Browse tenders — Qellal",
  description: "All published Ethiopian tender notices, newest first.",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export default async function TendersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = str(sp.q);
  const categorySlug = str(sp.category);
  const region = str(sp.region);
  const deadlineParam = str(sp.deadline);

  const [categories, regions] = await Promise.all([
    getCategories(),
    getDistinctRegions(),
  ]);

  const category = categorySlug
    ? categories.find((c) => c.slug === categorySlug)
    : undefined;
  const deadlineInDays =
    deadlineParam === "7" ? 7 : deadlineParam === "30" ? 30 : undefined;

  const result = await getPublishedTenders({
    sort: "recent",
    filters: { q, categoryId: category?.id, region, deadlineInDays },
  });

  const count = result.state === "ok" ? result.tenders.length : 0;
  const filtered = Boolean(q || categorySlug || region || deadlineParam);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Tenders
        </h1>
        <p className="mt-1 text-sm text-muted">
          {result.state === "ok"
            ? `${count} ${count === 1 ? "tender" : "tenders"}${filtered ? " match your filters" : " published, newest first"}.`
            : "Published Ethiopian tender notices."}
        </p>
      </header>

      <TenderFilters categories={categories} regions={regions} />

      {result.state === "not-configured" && (
        <div className="rounded-xl border border-dashed border-warn/40 bg-warn-soft p-4 text-sm text-warn">
          <p className="font-semibold">Supabase isn&apos;t connected yet.</p>
          <p className="mt-1">
            Add your keys to <code className="font-mono">.env.local</code>, then
            reload.
          </p>
        </div>
      )}

      {result.state === "error" && (
        <div className="rounded-xl border border-urgent/40 bg-urgent-soft p-4 text-sm text-urgent">
          <p className="font-semibold">Couldn&apos;t load tenders.</p>
          <p className="mt-1">{result.message}</p>
        </div>
      )}

      {result.state === "ok" && result.tenders.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          {filtered
            ? "No tenders match — try removing a filter."
            : "No published tenders yet. Check back soon."}
        </div>
      )}

      {result.state === "ok" && result.tenders.length > 0 && (
        <ul className="space-y-3">
          {result.tenders.map((t) => (
            <li key={t.id}>
              <TenderCard tender={t} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
