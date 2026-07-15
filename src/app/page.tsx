import { createClient } from "@/lib/supabase/server";

// Always fetch fresh during Phase 1 dev; we'll revisit caching later.
export const dynamic = "force-dynamic";

type TenderRow = {
  id: string;
  title: string;
  region: string | null;
  deadline: string;
  source_name: string;
  publishing_entity: string | null;
};

type FetchResult =
  | { state: "not-configured" }
  | { state: "error"; message: string }
  | { state: "ok"; tenders: TenderRow[] };

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
  return { state: "ok", tenders: (data ?? []) as TenderRow[] };
}

function daysLeft(deadline: string): number {
  return Math.ceil(
    (new Date(deadline).getTime() - Date.now()) / 86_400_000,
  );
}

export default async function Home() {
  const result = await getPublishedTenders();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          MVP · Phase 1
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          Qellal — Ethiopian Tenders
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          One place for every tender notice, with email &amp; Telegram alerts so
          you never miss a deadline.
        </p>
      </header>

      {result.state === "not-configured" && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">Supabase isn&apos;t connected yet.</p>
          <p className="mt-1">
            Add your keys to <code className="font-mono">.env.local</code> and run
            the SQL in <code className="font-mono">supabase/migrations/</code>,
            then reload — the seeded tenders will appear here.
          </p>
        </div>
      )}

      {result.state === "error" && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Couldn&apos;t load tenders.</p>
          <p className="mt-1">{result.message}</p>
        </div>
      )}

      {result.state === "ok" && result.tenders.length === 0 && (
        <div className="rounded-lg border p-4 text-sm text-gray-500">
          No published tenders yet.
        </div>
      )}

      {result.state === "ok" && result.tenders.length > 0 && (
        <ul className="space-y-3">
          {result.tenders.map((t) => {
            const d = daysLeft(t.deadline);
            return (
              <li key={t.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-medium">{t.title}</h2>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                      d <= 3
                        ? "bg-red-100 text-red-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {d}d left
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {t.region ?? "Ethiopia"}
                  {t.publishing_entity ? ` · ${t.publishing_entity}` : ""} ·
                  Source: {t.source_name}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
