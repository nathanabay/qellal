import Link from "next/link";
import { getPublishedTenders, getPublishedTenderCount } from "@/lib/tenders";
import { TenderCard } from "@/components/TenderCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [soon, count] = await Promise.all([
    getPublishedTenders({ limit: 3, sort: "deadline" }),
    getPublishedTenderCount(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      {/* Hero */}
      <section className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Ethiopian tender alerts
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-5xl">
          Never miss a tender deadline again
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">
          Every Ethiopian tender notice in one place, with email &amp; Telegram
          alerts a week before the deadline — so your bid is never late.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/tenders"
            className="w-full rounded-lg bg-primary px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-primary-hover sm:w-auto"
          >
            Browse tenders
            {typeof count === "number" && count > 0 ? ` (${count})` : ""}
          </Link>
          <span className="text-sm text-muted">Free · no account needed</span>
        </div>
      </section>

      {/* Closing soon preview */}
      {soon.state === "ok" && soon.tenders.length > 0 && (
        <section className="mt-14">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-semibold text-ink">Closing soon</h2>
            <Link
              href="/tenders"
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              View all →
            </Link>
          </div>
          <ul className="space-y-3">
            {soon.tenders.map((t) => (
              <li key={t.id}>
                <TenderCard tender={t} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {soon.state === "not-configured" && (
        <div className="mt-12 rounded-xl border border-dashed border-warn/40 bg-warn-soft p-4 text-sm text-warn">
          <p className="font-semibold">Supabase isn&apos;t connected yet.</p>
          <p className="mt-1">
            Add your keys to <code className="font-mono">.env.local</code> to see
            live tenders.
          </p>
        </div>
      )}
    </main>
  );
}
