import {
  getPublishedTenders,
  getCategories,
  getDistinctRegions,
} from "@/lib/tenders";
import { getSavedTenderIds } from "@/lib/saved";
import { createClient } from "@/lib/supabase/server";
import { TenderBrowser } from "@/components/TenderBrowser";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Browse tenders — Qellal",
  description: "All published Ethiopian tender notices, newest first.",
};

export default async function TendersPage() {
  // Load ALL open tenders (the deadline-relevant set, bounded) so none are
  // missed, plus the most-recent closed ones for the archive toggle. Both
  // batch past PostgREST's 1000-row cap. The deep closed archive is reachable
  // via the sector/region hubs and Insights. (A much larger open set would want
  // true server-side pagination.)
  const [openRes, closedRes, categories, regions] = await Promise.all([
    getPublishedTenders({ filters: { openOnly: true }, sort: "deadline", limit: 5000 }),
    getPublishedTenders({ filters: { closedOnly: true }, sort: "recent", limit: 1000 }),
    getCategories(),
    getDistinctRegions(),
  ]);
  const result: typeof openRes =
    openRes.state !== "ok"
      ? openRes
      : {
          state: "ok",
          tenders: [
            ...openRes.tenders,
            ...(closedRes.state === "ok" ? closedRes.tenders : []),
          ],
        };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const savedIds = user ? [...(await getSavedTenderIds())] : [];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Tenders
        </h1>
        <p className="mt-1 text-sm text-muted">
          Filter instantly, then save your search as an alert.
        </p>
        <nav className="mt-3 flex flex-wrap gap-2 text-sm">
          <a
            href="/categories"
            className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 font-medium text-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Browse by sector
          </a>
          <a
            href="/regions"
            className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 font-medium text-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Browse by region
          </a>
          <a
            href="/insights"
            className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 font-medium text-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Insights
          </a>
        </nav>
      </header>

      {result.state === "not-configured" && (
        <div className="rounded-xl border border-dashed border-warn/40 bg-warn-soft p-4 text-sm text-warn">
          <p className="font-semibold">Supabase isn’t connected yet.</p>
          <p className="mt-1">
            Add your keys to <code className="font-mono">.env.local</code>, then
            reload.
          </p>
        </div>
      )}

      {result.state === "error" && (
        <div className="rounded-xl border border-urgent/40 bg-urgent-soft p-4 text-sm text-urgent">
          <p className="font-semibold">Couldn’t load tenders.</p>
          <p className="mt-1">{result.message}</p>
        </div>
      )}

      {result.state === "ok" && (
        <TenderBrowser
          tenders={result.tenders}
          categories={categories}
          regions={regions}
          isLoggedIn={Boolean(user)}
          savedIds={savedIds}
        />
      )}
    </main>
  );
}
