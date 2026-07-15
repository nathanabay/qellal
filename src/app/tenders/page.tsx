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
  const [result, categories, regions] = await Promise.all([
    getPublishedTenders({ sort: "recent" }),
    getCategories(),
    getDistinctRegions(),
  ]);

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
      </header>

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
