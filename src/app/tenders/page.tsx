import { getPublishedTenders } from "@/lib/tenders";
import { TenderCard } from "@/components/TenderCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Browse tenders — Qellal",
  description: "All published Ethiopian tender notices, newest first.",
};

export default async function TendersPage() {
  const result = await getPublishedTenders({ sort: "recent" });
  const count = result.state === "ok" ? result.tenders.length : 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Tenders
        </h1>
        <p className="mt-1 text-sm text-muted">
          {result.state === "ok"
            ? `${count} published ${count === 1 ? "tender" : "tenders"}, newest first.`
            : "Published Ethiopian tender notices."}
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

      {result.state === "ok" && result.tenders.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          No published tenders yet. Check back soon.
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
