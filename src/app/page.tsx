import { createClient } from "@/lib/supabase/server";
import { TenderCard, type TenderCardData } from "@/components/TenderCard";

// Always fetch fresh during Phase 1/2 dev; we'll revisit caching later.
export const dynamic = "force-dynamic";

type FetchResult =
  | { state: "not-configured" }
  | { state: "error"; message: string }
  | { state: "ok"; tenders: TenderCardData[] };

async function getPublishedTenders(): Promise<FetchResult> {
  // No keys yet → show a helpful "connect Supabase" state instead of crashing.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { state: "not-configured" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenders")
    .select("id,title,region,deadline,source_name,publishing_entity")
    .eq("status", "published")
    .order("deadline", { ascending: true });

  if (error) {
    console.error("tenders fetch failed:", error.message);
    return { state: "error", message: error.message };
  }
  return { state: "ok", tenders: data ?? [] };
}

export default async function Home() {
  const result = await getPublishedTenders();
  const count = result.state === "ok" ? result.tenders.length : 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Qellal
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Latest Ethiopian tenders
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every tender notice in one place — with email &amp; Telegram alerts so
          you never miss a deadline.
          {result.state === "ok" && count > 0 && (
            <span className="text-ink"> {count} open now.</span>
          )}
        </p>
      </header>

      {result.state === "not-configured" && (
        <div className="rounded-xl border border-dashed border-warn/40 bg-warn-soft p-4 text-sm text-warn">
          <p className="font-semibold">Supabase isn&apos;t connected yet.</p>
          <p className="mt-1">
            Add your keys to <code className="font-mono">.env.local</code>, then
            reload — the seeded tenders will appear here.
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
        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          No published tenders yet.
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
